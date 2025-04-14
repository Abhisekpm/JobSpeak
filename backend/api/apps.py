from django.apps import AppConfig


class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        """Import signals when the app is ready."""
        try:
            import api.signals
            print("Imported api.signals successfully.") # Add print for confirmation
        except ImportError:
            print("Could not import api.signals.") # Add print for error
            pass 