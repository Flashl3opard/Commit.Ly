# Kafka local setup (KRaft mode, no ZooKeeper, no Docker)

Commit.ly uses Apache Kafka as the event backbone between GitHub Service and
Chat Service: GitHub Service publishes normalized GitHub activity events to
the `github.events` topic; Chat Service consumes them, creates the same
system messages it always has, and broadcasts them over the existing
WebSocket path. This is entirely optional infrastructure — every other
Commit.ly feature works with Kafka absent (see "Running without Kafka"
below).

Kafka runs here as a plain native process (a downloaded binary distribution),
not a container — no Docker is required for this setup.

## 1. Prerequisites

- **Java 17+** (Kafka's broker runs on the JVM). Check with `java -version`.
- ~200MB free disk space for the Kafka distribution + its local log data.

## 2. Download Kafka (one-time)

Kafka 4.x ships in **KRaft mode by default** — ZooKeeper support was removed
entirely in 4.0, so there is no ZooKeeper configuration anywhere in this
setup.

```bash
mkdir -p tools && cd tools
curl -L "https://dlcdn.apache.org/kafka/4.3.1/kafka_2.13-4.3.1.tgz" -o kafka.tgz
tar -xzf kafka.tgz
```

This creates `tools/kafka_2.13-4.3.1/`. The rest of this doc refers to that
directory as `$KAFKA_HOME`.

## 3. Configure a single-node KRaft cluster (one-time)

Create `$KAFKA_HOME/config/kraft/commitly.properties` (a local-dev-only
config — a combined broker+controller node, which is exactly what local
development needs and is the standard KRaft "quick start" shape):

```properties
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:9093

listeners=PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093
inter.broker.listener.name=PLAINTEXT
controller.listener.names=CONTROLLER
advertised.listeners=PLAINTEXT://localhost:9092

log.dirs=./data/kraft-combined-logs

num.partitions=1
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1

# Local dev only — real deployments should not auto-create topics; here it
# just avoids a manual `kafka-topics.sh --create` step for a single-topic
# local setup.
auto.create.topics.enable=true
```

Format the storage directory once (generates a cluster UUID — every KRaft
cluster needs one; this only needs to run once, not on every startup):

```bash
cd $KAFKA_HOME
bin/windows/kafka-storage.bat random-uuid
# copy the printed UUID, then:
bin/windows/kafka-storage.bat format -t <printed-uuid> -c config/kraft/commitly.properties
```

(On macOS/Linux use `bin/kafka-storage.sh` instead of the `.bat` scripts —
everything else is identical.)

## 4. Start Kafka

```bash
cd $KAFKA_HOME
bin/windows/kafka-server-start.bat config/kraft/commitly.properties
```

Leave this running in its own terminal. It listens on `localhost:9092`
(client/broker traffic) — this is the value `KAFKA_BROKERS` in each
service's `.env` already points to by default.

The `github.events` and `github.events.dlq` topics are created
automatically on first publish (`auto.create.topics.enable=true` above) —
no manual topic-creation step is required for local dev.

## 5. (Optional) Kafka UI

For inspecting topics/partitions/consumer groups/messages/offsets visually,
[kafka-ui](https://github.com/provectus-labs/kafka-ui) (or any Kafka UI
tool) can be pointed at `localhost:9092`. This is purely a local
convenience — Commit.ly itself never depends on it being present. Not
included by default since this task deliberately does not introduce Docker;
run it however you'd like (a locally-installed binary, `npx`, etc.) if you
want it.

## 6. Bring up the rest of Commit.ly

```bash
# 1. PostgreSQL running locally (as already required, unrelated to Kafka)

# 2. Kafka (from step 4 above, in its own terminal)

# 3. Backend services
cd backend
npm run dev

# 4. Frontend
cd frontend
npm run dev
```

Each service's `.env` already has the Kafka variables pre-filled for local
dev (`KAFKA_BROKERS=localhost:9092`, etc.) — see `.env.example` in
`services/github-service` and `services/chat-service` for the full list.

## 7. Verify the end-to-end path

1. Create (or use an existing) Commit.ly room backed by a real GitHub
   repository with the Commit.ly GitHub App installed.
2. Trigger a supported GitHub event against that repository — push a commit,
   open/close/reopen/merge a PR, or open/close/reopen an issue.
3. Watch GitHub Service's logs for `[event] publishing` / `[event]
   published` (from `kafka.producer.ts`).
4. Watch Chat Service's logs for `[event] consumed` / `[event] processed`
   (from `kafka.consumer.ts`).
5. The room's chat should show the new GitHub activity system message,
   delivered over the existing WebSocket connection — same
   PushActivityCard/PullRequestActivityCard/IssueActivityCard rendering as
   before this refactor, since the frontend never had to change.

To see the raw message on the topic instead, `kafka-console-consumer.bat`
works without any UI:

```bash
cd $KAFKA_HOME
bin/windows/kafka-console-consumer.bat --bootstrap-server localhost:9092 --topic github.events --from-beginning
```

### Testing consumer restart / duplicate handling

Stop Chat Service (`Ctrl+C`) after a webhook has been received but before
restarting it, then trigger another GitHub event and restart Chat Service.
The consumer resumes from Kafka's committed offset for the
`commitly-chat-service` group (no messages replayed or skipped). To confirm
duplicate delivery is handled safely, replay a message already on the topic
(e.g. reset the consumer group's offset with `kafka-consumer-groups.bat
--reset-offsets`) — Chat Service will log "duplicate event ignored" and
will not create a second system message, because of the unique constraint
on `Message.sourceEventId`.

## Running without Kafka

Every other Commit.ly feature — auth, rooms, chat, DMs, threads, GitHub
OAuth/App linking — works with `KAFKA_BROKERS` left unset in both
`github-service/.env` and `chat-service/.env`. In that state:

- GitHub Service still verifies/normalizes webhooks exactly as before, but
  the publish step fails immediately and the webhook responds to GitHub
  with a retryable `502` — GitHub will keep retrying that delivery until
  Kafka is available. GitHub activity simply doesn't reach Commit.ly rooms
  while Kafka is down, same as if the old synchronous HTTP call had failed.
- Chat Service never starts the `github.events` consumer and logs that
  Kafka is not configured — every REST/WebSocket path is unaffected.
- `GET /ready` on both services reports `kafka.configured: false` if you
  want to check this programmatically.
