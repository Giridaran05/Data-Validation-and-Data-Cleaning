"""
DIT Internship 2026 - TASK 07: Data Cleaning and Validation Engine
Module: logger.py
Configurable, structured logging setup with colored console output,
file handlers, and an in-memory buffer for real-time UI/API telemetry.
"""

import logging
import sys
from typing import List, Optional


class MemoryLogHandler(logging.Handler):
    """Stores recent log messages in memory for UI retrieval and test assertion."""
    def __init__(self, capacity: int = 500):
        super().__init__()
        self.capacity = capacity
        self.logs: List[dict] = []

    def emit(self, record: logging.LogRecord):
        log_entry = {
            "timestamp": record.created,
            "formatted_time": self.format(record).split(" | ")[0] if " | " in self.format(record) else "",
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        }
        self.logs.append(log_entry)
        if len(self.logs) > self.capacity:
            self.logs.pop(0)

    def get_logs(self) -> List[dict]:
        return list(self.logs)

    def clear(self):
        self.logs.clear()


_memory_handler: Optional[MemoryLogHandler] = None


def get_memory_log_handler() -> MemoryLogHandler:
    global _memory_handler
    if _memory_handler is None:
        _memory_handler = MemoryLogHandler()
    return _memory_handler


def setup_logger(
    name: str = "DataEngine",
    level: int = logging.INFO,
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Sets up a standardized logger for the Data Cleaning and Validation Engine.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.handlers.clear()

    # Formatter with timestamp, level, module, and message
    log_format = "%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    formatter = logging.Formatter(fmt=log_format, datefmt=date_format)

    # Console Stream Handler
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(level)
    logger.addHandler(stream_handler)

    # Memory Handler for UI/API
    mem_handler = get_memory_log_handler()
    mem_handler.setFormatter(formatter)
    mem_handler.setLevel(level)
    logger.addHandler(mem_handler)

    # Optional File Handler
    if log_file:
        file_handler = logging.FileHandler(log_file, mode="a", encoding="utf-8")
        file_handler.setFormatter(formatter)
        file_handler.setLevel(level)
        logger.addHandler(file_handler)

    return logger
