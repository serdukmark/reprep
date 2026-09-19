from dataclasses import dataclass
import os


@dataclass
class Settings:
    database: str = 'data/reprep.sqlite3'
    environment: str = 'development'
    demo: bool = False
    bot_token: str = ''
    ai_url: str = ''
    ai_key: str = ''
    ai_data_approved: bool = False
    openrouter_key: str = ''
    openrouter_model: str = ''
    synthetic_only: bool = True
    ai_daily_limit: int = 50
    session_hours: int = 12
    invite_hours: int = 72

    @classmethod
    def load(cls):
        # Local .env only. Environment variables supplied by Docker take precedence.
        from pathlib import Path
        env = Path(__file__).resolve().parents[2] / '.env'
        if env.exists():
            for line in env.read_text().splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, value = line.split('=', 1)
                    os.environ.setdefault(key.strip(), value.strip())
        value = cls(ai_daily_limit=max(0,int(os.getenv('AI_DAILY_LIMIT','50'))), database=os.getenv('DATABASE_PATH', 'data/reprep.sqlite3'),
                    environment=os.getenv('APP_ENV', 'development'),
                    demo=os.getenv('DEMO_ENABLED', 'false').lower() == 'true',
                    bot_token=os.getenv('MAX_BOT_TOKEN', ''),
                    ai_url=os.getenv('AI_ADAPTER_URL', ''), ai_key=os.getenv('AI_ADAPTER_KEY', ''),
                    ai_data_approved=os.getenv('AI_DATA_APPROVED', 'false').lower() == 'true',
                    openrouter_key=os.getenv('OPENROUTER_API_KEY', ''), openrouter_model=os.getenv('OPENROUTER_MODEL', ''),
                    synthetic_only=os.getenv('AI_SYNTHETIC_ONLY', 'true').lower() == 'true')
        if value.demo and value.environment not in ('development', 'test', 'demo'):
            raise RuntimeError('Demo access is forbidden in this environment')
        if value.ai_url and (not value.ai_url.startswith('https://') or not value.ai_data_approved):
            raise RuntimeError('External AI requires HTTPS and explicit data approval')
        return value
