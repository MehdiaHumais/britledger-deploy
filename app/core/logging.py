import logging
import sys

def setup_logging():
    logging.basicConfig(
        stream=sys.stdout,
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

class LoggerAdapter(logging.LoggerAdapter):
    def error(self, msg, *args, **kwargs):
        # Allow sending extra kwargs without crashing if they aren't standard
        if 'exc_info' in kwargs:
            pass
        # Ignore extra kwargs we pass
        kwargs.pop("path", None)
        kwargs.pop("error", None)
        super().error(msg, *args, **kwargs)
        
    def info(self, msg, *args, **kwargs):
        kwargs.pop("version", None)
        kwargs.pop("env", None)
        super().info(msg, *args, **kwargs)
        
    def warning(self, msg, *args, **kwargs):
        kwargs.pop("error", None)
        super().warning(msg, *args, **kwargs)

def get_logger(name: str):
    logger = logging.getLogger(name)
    return LoggerAdapter(logger, {})
