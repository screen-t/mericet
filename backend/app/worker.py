"""Living Graph Background Worker & Cron Execution Entrypoint.

Usage:
    # Run once (for cron / scheduled execution):
    python -m app.worker --once

    # Run as a continuous background daemon worker:
    python -m app.worker --daemon --interval 60

    # Sync a specific user:
    python -m app.worker --user-id <uuid>
"""

import sys
import time
import signal
import logging
import argparse
from app.services.living_graph import LivingGraphEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [LivingGraphWorker] %(message)s",
)
logger = logging.getLogger("worker")

_RUNNING = True


def _handle_exit_signal(signum, frame):
    global _RUNNING
    logger.info(f"Received shutdown signal ({signum}), stopping worker gracefully...")
    _RUNNING = False


def run_once(tool_repo=None, vault_repo=None, living_graph_repo=None):
    """Executes a single scheduled sync cycle across all active connected tools."""
    if not (tool_repo and vault_repo and living_graph_repo):
        from app.deps import get_vault_repo, get_connected_tool_repo, get_living_graph_repo
        tool_repo = tool_repo or get_connected_tool_repo()
        vault_repo = vault_repo or get_vault_repo()
        living_graph_repo = living_graph_repo or get_living_graph_repo()

    logger.info("Starting Living Graph scheduled sync run...")
    summary = LivingGraphEngine.run_scheduled_sync(
        tool_repo=tool_repo,
        vault_repo=vault_repo,
        living_graph_repo=living_graph_repo,
    )
    logger.info(f"Sync run finished: status={summary.get('status')} duration={summary.get('duration_ms')}ms synced={summary.get('synced_tools')} created={summary.get('highlights_created')} updated={summary.get('highlights_updated')}")
    return summary


def run_daemon(interval_minutes: int = 60, tool_repo=None, vault_repo=None, living_graph_repo=None):
    """Runs continuously as a background worker with configured interval."""
    signal.signal(signal.SIGINT, _handle_exit_signal)
    signal.signal(signal.SIGTERM, _handle_exit_signal)

    if not (tool_repo and vault_repo and living_graph_repo):
        from app.deps import get_vault_repo, get_connected_tool_repo, get_living_graph_repo
        tool_repo = tool_repo or get_connected_tool_repo()
        vault_repo = vault_repo or get_vault_repo()
        living_graph_repo = living_graph_repo or get_living_graph_repo()

    logger.info(f"Starting Living Graph Daemon Worker (interval: {interval_minutes} minutes)...")

    interval_seconds = interval_minutes * 60
    while _RUNNING:
        try:
            run_once(tool_repo, vault_repo, living_graph_repo)
        except Exception as e:
            logger.error(f"Error in worker daemon cycle: {LivingGraphEngine._sanitize_for_logging(e)}")

        logger.info(f"Sleeping for {interval_minutes} minutes until next scheduled sync...")
        # Sleep in small increments to respond quickly to termination signals
        slept = 0
        while _RUNNING and slept < interval_seconds:
            time.sleep(min(5, interval_seconds - slept))
            slept += 5

    logger.info("Worker daemon stopped cleanly.")


def main():
    parser = argparse.ArgumentParser(description="Mericet Living Graph Worker")
    parser.add_argument("--once", action="store_true", help="Run a single sync cycle and exit")
    parser.add_argument("--daemon", action="store_true", help="Run continuously in background")
    parser.add_argument("--interval", type=int, default=60, help="Interval in minutes for daemon mode (default: 60)")
    parser.add_argument("--user-id", type=str, default=None, help="Sync a specific user ID")
    args = parser.parse_args()

    if args.user_id:
        from app.deps import get_vault_repo, get_connected_tool_repo
        tool_repo = get_connected_tool_repo()
        vault_repo = get_vault_repo()
        logger.info(f"Synchronizing tools for user {args.user_id}...")
        res = LivingGraphEngine.sync_user_tools(args.user_id, tool_repo, vault_repo)
        logger.info(f"User sync result: {res}")
        sys.exit(0)

    if args.daemon:
        run_daemon(interval_minutes=args.interval)
    else:
        # Default or --once: run single cycle
        summary = run_once()
        if summary.get("status") == "failed":
            sys.exit(1)
        sys.exit(0)


if __name__ == "__main__":
    main()
