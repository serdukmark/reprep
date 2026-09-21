from dataclasses import dataclass, field
import os


@dataclass
class Settings:
    database: str = 'data/reprep.sqlite3'
    environment: str = 'development'
    demo: bool = False
    bot_token: str = field(default='', repr=False)
    public_base_url: str = ''
    max_bot_id: int = 0
    max_bot_enabled: bool = False
    max_outbound_enabled: bool = False
    max_webhook_secret: str = field(default='', repr=False)
    max_ca_bundle: str = ''
    ai_url: str = ''
    ai_key: str = field(default='', repr=False)
    ai_data_approved: bool = False
    openrouter_key: str = field(default='', repr=False)
    openrouter_model: str = ''
    synthetic_only: bool = True
    ai_daily_limit: int = 50
    guardian_data_approved: bool = False
    account_deletion_approved: bool = False
    session_hours: int = 12
    invite_hours: int = 72

    @classmethod
    def load(cls):
        # Local .env only. Environment variables supplied by Docker take precedence.
        from pathlib import Path
        env = Path(__file__).resolve().parents[2] / '.env'
        local_values = {}
        if env.exists():
            for line in env.read_text().splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, value = line.split('=', 1)
                    local_values[key.strip()] = value.strip()
        # Do not cache file secrets in os.environ. A fresh load sees a rotated file.
        values = {**local_values, **os.environ}
        get = values.get
        value = cls(account_deletion_approved=get('ACCOUNT_DELETION_APPROVED','false').lower()=='true', guardian_data_approved=get('GUARDIAN_DATA_APPROVED','false').lower()=='true', ai_daily_limit=max(0,int(get('AI_DAILY_LIMIT','50'))), database=get('DATABASE_PATH', 'data/reprep.sqlite3'),
                    environment=get('APP_ENV', 'development'),
                    demo=get('DEMO_ENABLED', 'false').lower() == 'true',
                    bot_token=get('MAX_BOT_TOKEN', ''),
                    public_base_url=get('PUBLIC_BASE_URL','').rstrip('/'),
                    max_bot_id=int(get('MAX_BOT_ID','0') or 0),
                    max_bot_enabled=get('MAX_BOT_ENABLED','false').lower()=='true',
                    max_outbound_enabled=get('MAX_OUTBOUND_ENABLED','false').lower()=='true',
                    max_webhook_secret=get('MAX_WEBHOOK_SECRET',''),
                    max_ca_bundle=get('MAX_CA_BUNDLE',''),
                    ai_url=get('AI_ADAPTER_URL', ''), ai_key=get('AI_ADAPTER_KEY', ''),
                    ai_data_approved=get('AI_DATA_APPROVED', 'false').lower() == 'true',
                    openrouter_key=get('OPENROUTER_API_KEY', ''), openrouter_model=get('OPENROUTER_MODEL', ''),
                    synthetic_only=get('AI_SYNTHETIC_ONLY', 'true').lower() == 'true')
        if value.demo and value.environment not in ('development', 'test', 'demo'):
            raise RuntimeError('Demo access is forbidden in this environment')
        if value.ai_url and (not value.ai_url.startswith('https://') or not value.ai_data_approved):
            raise RuntimeError('External AI requires HTTPS and explicit data approval')
        return value
