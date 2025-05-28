import os
import django
import sys

def main():
    # --- Setup Django Environment ---
    
    # Path to the directory containing this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Path to the 'backend' directory (one level up from 'scripts/')
    # This assumes the script is in 'backend/scripts/'
    # and 'manage.py' is in 'backend/'
    backend_main_dir = os.path.dirname(script_dir) 
    
    # Add the 'backend' directory (where manage.py is) to sys.path 
    # to allow imports like 'from api.models...' if 'api' is an app at that level.
    # If 'api' is inside another directory like 'backend/project_name/api', adjustments are needed.
    # Based on your structure, 'api' is likely directly under 'backend'.
    sys.path.insert(0, backend_main_dir) 
    
    # Set the DJANGO_SETTINGS_MODULE environment variable.
    # This should point to your project's settings file, relative to a directory in sys.path.
    # If your settings.py is in backend/backend/settings.py, 
    # and backend_main_dir (which is .../JobSpeakV2/backend) is in sys.path,
    # then 'backend.settings' should be correct.
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings') # VERIFY THIS!
    
    try:
        django.setup()
    except Exception as e:
        print(f"ERROR: Django setup failed: {e}")
        print(f"Current sys.path: {sys.path}")
        print(f"DJANGO_SETTINGS_MODULE: {os.environ.get('DJANGO_SETTINGS_MODULE')}")
        sys.exit(1)
        
    print("Django environment setup successfully.")

    # --- Import Django models and tasks AFTER setup ---
    from api.models import Interview # Assuming api is an app in your Django project
    from api.tasks import process_interview_analysis_task, process_interview_coaching_task

    # --- Get interview_id from command line arguments ---
    if len(sys.argv) < 2:
        print("Usage: python scripts/reprocess_interview.py <interview_id>")
        print(" (Ensure you run this from the 'backend' directory, e.g., python scripts/your_script_name.py ID)")
        sys.exit(1)

    try:
        interview_id_to_reprocess = int(sys.argv[1])
    except ValueError:
        print(f"Error: Invalid interview_id '{sys.argv[1]}'. Must be an integer.")
        sys.exit(1)

    print(f"Attempting to reprocess analysis for Interview ID: {interview_id_to_reprocess}")

    # --- Fetch the interview instance ---
    try:
        interview = Interview.objects.get(id=interview_id_to_reprocess)
        print(f"Found interview: {interview.id} - {interview.name} (Current Analysis Status: {interview.status_analysis})")

        # --- Optional: Reset status to 'pending' ---
        # if interview.status_analysis == Interview.STATUS_FAILED or interview.status_analysis == Interview.STATUS_COMPLETED:
        #     print(f"Resetting analysis status to PENDING for interview {interview.id}...")
        #     interview.status_analysis = Interview.STATUS_PENDING
        #     interview.analysis_results = None 
        #     if interview.status_coaching != Interview.STATUS_PENDING: # Also reset coaching if it depends on analysis
        #         interview.status_coaching = Interview.STATUS_PENDING
        #         interview.coaching_feedback = None
        #         interview.save(update_fields=['status_analysis', 'analysis_results', 'status_coaching', 'coaching_feedback', 'updated_at'])
        #     else:
        #         interview.save(update_fields=['status_analysis', 'analysis_results', 'updated_at'])
        #     print(f"Status for interview {interview.id} analysis is now PENDING.")


        # --- Call the background task function ---
        print(f"Scheduling 'process_interview_analysis_task' for interview ID: {interview.id}...")
        process_interview_analysis_task(interview.id) 
        print(f"'process_interview_analysis_task' has been scheduled for interview ID: {interview.id}.")

        print(f"Scheduling 'process_interview_coaching_task' for interview ID: {interview.id}...")
        process_interview_coaching_task(interview.id)
        print(f"'process_interview_coaching_task' has been scheduled for interview ID: {interview.id}.")
        
        print("Please ensure your Django background task worker ('python manage.py process_tasks') is running to execute them.")

    except Interview.DoesNotExist:
        print(f"Error: Interview with ID {interview_id_to_reprocess} not found.")
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main() 