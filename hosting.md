Login as Ubuntu

cd /var/www/jobspeak/JobSpeak/backend
source venv/bin/activate

Check status:
sudo systemctl status

the service running your Django application via Gunicorn
You also have a background task runner
And Nginx running as a reverse proxy

Restart Gunicorn: 
sudo systemctl restart gunicorn-jobspeak.service

Restart the Background Task Runner:
sudo systemctl restart background-tasks-jobspeak.service

Check Status:
sudo systemctl status gunicorn-jobspeak.service
sudo systemctl status background-tasks-jobspeak.service


# Hosting Guide: Django Backend on Lightsail + React Frontend on Amplify

This guide outlines the steps to deploy the Django backend to AWS Lightsail and the React (Vite) frontend to AWS Amplify.

## Phase 1: Backend Setup on AWS Lightsail

1.  **Create Lightsail Instance:**
    *   Go to AWS Lightsail console > Create instance.
    *   **Location:** Choose a suitable AWS Region.
    *   **Platform:** Linux/Unix.
    *   **Blueprint:** OS Only > Ubuntu 22.04 LTS (or recent LTS).
    *   **Instance Plan:** Start with at least 1 GB RAM (e.g., $5/month or $10/month plan). Resize later if needed.
    *   **Name:** Give it a unique name (e.g., `jobspeak-backend`).
    *   Create instance.

2.  **Create Static IP Address:**
    *   Instance > Networking tab > Create static IP.
    *   Attach it to your instance.
    *   **Note down the Static IP address.**

3.  **Configure Firewall:**
    *   Instance > Networking tab > Firewall.
    *   Ensure ports are open:
        *   `SSH` (TCP, Port 22) - Optionally restrict to your IP.
        *   `HTTP` (TCP, Port 80).
        *   `HTTPS` (TCP, Port 443) - For later SSL setup.

4.  **Connect via SSH:**
    *   Instance > Connect tab.
    *   Use browser SSH or your local client with the downloaded key pair.

5.  **Install System Packages:**
    *   Connect via SSH and run:
        ```bash
        sudo apt update
        sudo apt upgrade -y
        sudo apt install python3-pip python3-venv python3-dev git nginx -y
        # build-essential might also be needed depending on package dependencies
        # sudo apt install build-essential -y
        ```

6.  **Set up Database (Lightsail Managed PostgreSQL Recommended):**
    *   Lightsail Console > Databases tab > Create database.
    *   Choose PostgreSQL, select a plan.
    *   Set username and password.
    *   Configure accessibility (e.g., "Public mode" initially, secure later).
    *   Note down **endpoint (hostname)**, **port**, **DB name**, **username**, **password**.

7.  **Clone Backend Code:**
    *   Create a deployment directory (e.g., `/var/www/jobspeak`). Adjust ownership (`sudo chown ubuntu:ubuntu ...`).
    *   `cd /var/www/jobspeak`
    *   `git clone <your-backend-repo-url> .` (Clone into current dir)

8.  **Set up Python Virtual Environment:**
    *   `cd JobSpeak/backend` (Navigate to your Django project root within the cloned repo)
    *   `python3 -m venv venv`
    *   `source venv/bin/activate`

9.  **Install Python Dependencies:**
    *   `(venv) pip install -r requirements.txt`
    *   `(venv) pip install gunicorn python-dotenv dj-database-url`


10. **Configure Django for Production:**
    *   **Create `.env` file:** In `/var/www/jobspeak/JobSpeakV2/backend/` directory (next to `manage.py`). **DO NOT COMMIT TO GIT.** Fill it with your actual secrets:
        ```dotenv

	Login as Ubuntu

        cd /var/www/jobspeak/JobSpeak/backend
	source venv/bin/activate
        
	DEBUG=False
        SECRET_KEY="2c3$y_5uduhvxpczf%l5d13&p5s-b5_4t%6mlimudv0vh+(0l@"
        
	ALLOWED_HOSTS='<Your-Lightsail-Static-IP>,localhost,127.0.0.1' # Add domain later

	postgres://<USER>:<PASSWORD>@<HOST>:<PORT>/<DBNAME>

	DATABASE_URL='postgres://dbmasteruser:csYo)JZc5=9^jgh,7L{-5)&nn*bq``3I@ls-013535a37a8299bbb0e28eaac5fc4a82580fcbde.cc7gwo24u74o.us-east-1.rds.amazonaws.com:5432/dbmaster'
        
        AWS_ACCESS_KEY_ID='<your_aws_key_id>'
        AWS_SECRET_ACCESS_KEY='<your_aws_secret>'
        AWS_STORAGE_BUCKET_NAME='jobspeak-v2' # Confirm this
        AWS_S3_REGION_NAME='<your_bucket_region>'
        GOOGLE_API_KEY='<your_google_api_key>'
        GOOGLE_CLIENT_ID='<your_google_client_id>'
        GOOGLE_CLIENT_SECRET='<your_google_client_secret>'
        # Add other env vars (e.g., EMAIL settings for production)
        ```
    *   **Modify `settings.py`:** Ensure your `backend/backend/settings.py` reads these values using `os.getenv()`. Use `dj_database_url.config()` for the database. Ensure `DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'` and `ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')`. Define `STATIC_ROOT = BASE_DIR / 'staticfiles'`. Set `CORS_ALLOWED_ORIGINS` (see Phase 3).
    *   **Modify `manage.py` and `backend/wsgi.py`:** Add the following lines near the top of both files to load the `.env`:
        ```python
        import os # Ensure os is imported
        from dotenv import load_dotenv

        # Determine the path to the .env file relative to the script
        # For manage.py (already in backend/):
        # env_path = os.path.join(os.path.dirname(__file__), '.env')
        # For wsgi.py (in backend/backend/):
        # env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        # More robust way assuming BASE_DIR might be set in settings already used by wsgi?
        # Or construct absolute path based on expected deployment structure:
        # env_path = '/var/www/jobspeak/JobSpeakV2/backend/.env' # Less flexible if path changes

        # Simpler approach if both scripts are run from the backend/ directory context:
        load_dotenv() # python-dotenv searches parent directories by default
        ```
        *(Note: Loading .env might require adjustments based on your exact setup and how you run Gunicorn/manage.py. Ensure the .env path is correct relative to where the script is executed or use an absolute path)*

        CORS_ALLOWED_ORIGINS = [
            "https://master.d3gamwprogkgd9.amplifyapp.com", # <-- Replace with your actual Amplify URL
            # You might want to add your localhost for local frontend testing too:
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            # Add your custom domain later if you set one up:
            # "https://yourcustomdomain.com",
        ]

CORS_ALLOWED_ORIGINS=https://master.d3gamwprogkgd9.amplifyapp.com,http://localhost:5173,http://127.0.0.1:5173


11. **Run Production Checks & Migrations:**
    *   Make sure your virtual environment is active (`source /var/www/jobspeak/JobSpeak/venv/bin/activate` if needed).
    *   Navigate to the Django project directory: `cd /var/www/jobspeak/JobSpeakV2/backend`
    *   `(venv) python manage.py check --deploy` (Fix any critical warnings)
    *   `(venv) python manage.py migrate` (Apply migrations to the Postgres DB)
    *   `(venv) python manage.py collectstatic` (Gather static files into `STATIC_ROOT`)

12. **Set up Gunicorn Systemd Service:**
    *   Create the service file: `sudo nano /etc/systemd/system/gunicorn-jobspeak.service`
    *   Paste and **carefully verify all paths and the User/Group**:
        ```ini
        [Unit]
        Description=gunicorn daemon for JobSpeak backend
        # Ensure database service is started first if Postgres is local (not needed for managed DB)
        # Requires=postgresql.service
        # After=network.target postgresql.service
        After=network.target

        [Service]
        User=ubuntu # IMPORTANT: Verify this matches your SSH/deployment user
        Group=www-data # Or the user's primary group if different
        # Use the full path to the directory containing manage.py
        WorkingDirectory=/var/www/jobspeak/JobSpeakV2/backend
        # Use the full path to the gunicorn executable in your venv
        # Use the full path to the .env file
        ExecStart=/var/www/jobspeak/JobSpeakV2/venv/bin/gunicorn --workers 3 --bind unix:/run/gunicorn-jobspeak.sock backend.wsgi:application
        EnvironmentFile=/var/www/jobspeak/JobSpeakV2/backend/.env
        Restart=always
        # Optional: Logging configuration
        # StandardOutput=journal
        # StandardError=journal
        # SyslogIdentifier=gunicorn-jobspeak

        [Install]
        WantedBy=multi-user.target
        ```
    *   Enable and start the service:
        ```bash
        sudo systemctl enable gunicorn-jobspeak
        sudo systemctl start gunicorn-jobspeak
        sudo systemctl status gunicorn-jobspeak # Check status, look for errors
        # If errors: sudo journalctl -u gunicorn-jobspeak
        ```

13. **Set up Nginx Reverse Proxy:**
    *   Create Nginx config file: `sudo nano /etc/nginx/sites-available/jobspeak`
    *   Paste and **modify `server_name`**:
        ```nginx
        server {
            listen 80;
            server_name <Your-Lightsail-Static-IP>; # Replace with your Static IP or domain

            client_max_body_size 20M; # Increase max upload size if needed (adjust value)

            location = /favicon.ico { access_log off; log_not_found off; }

            # Static files (served by Nginx IF you are NOT using S3 for static files)
            # location /static/ {
            #    # Use the full path where collectstatic placed files
            #    alias /var/www/jobspeak/JobSpeakV2/backend/staticfiles/;
            # }

            # Media files (served by Nginx IF you are NOT using S3 for media files - YOU ARE USING S3)
            # location /media/ {
            #    # Use the full path defined by MEDIA_ROOT in settings.py
            #    alias /var/www/jobspeak/JobSpeakV2/backend/media/;
            # }

            # Pass all other requests to Gunicorn via the socket
            location / {
                proxy_set_header Host $http_host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                include proxy_params; # Contains other useful proxy settings
                proxy_pass http://unix:/run/gunicorn-jobspeak.sock;
            }
        }
        ```
    *   Enable the site, remove default, test config, and restart Nginx:
        ```bash
        sudo ln -s /etc/nginx/sites-available/jobspeak /etc/nginx/sites-enabled/
        # Check if default exists before removing
        if [ -f /etc/nginx/sites-enabled/default ]; then sudo rm /etc/nginx/sites-enabled/default; fi
        sudo nginx -t # Check for syntax errors
        sudo systemctl restart nginx


[Unit]
Description=gunicorn daemon for JobSpeak backend
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/var/www/jobspeak/JobSpeak/backend
# Ensure this line is complete and correct:
ExecStart=/var/www/jobspeak/JobSpeak/backend/venv/bin/gunicorn --workers 3 --bind unix:/run/gunicorn-jobspeak.sock backend.wsgi:application
EnvironmentFile=/var/www/jobspeak/JobSpeak/backend/.env
Restart=always

[Install]
WantedBy=multi-user.target

ExecStart=/var/www/jobspeak/JobSpeak/backend/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:8000 backend.wsgi:application


sudo nano /etc/nginx/sites-available/jobspeak

server {
        listen 80;
        server_name 34.239.59.106; # Replace with your Static IP or domain later

        client_max_body_size 20M; # Allow larger file uploads if needed

        location = /favicon.ico { access_log off; log_not_found off; }

        # Static files - Nginx can serve these directly IF they aren't on S3
        # If your STATIC_URL setting points to S3, you don't need this block.
        # If STATIC_URL is '/static/', uncomment and verify the alias path.
        # location /static/ {
        #    alias /var/www/jobspeak/JobSpeakV2/backend/staticfiles/;
        # }

        # Media files - Nginx should NOT serve these; they come from S3 via MEDIA_URL
        # location /media/ {
        #    # This block should generally be REMOVED when using S3 for media
        #    alias /var/www/jobspeak/JobSpeakV2/backend/media/;
        # }

        # Pass all other requests to Gunicorn listening on port 8000
        location / {
            proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            include proxy_params;
            # --- IMPORTANT: Point to Gunicorn's port ---
            proxy_pass http://127.0.0.1:8000;
            # --- Do NOT use the socket path here ---
            # proxy_pass http://unix:/run/gunicorn-jobspeak.sock;
        }
    }



        ```
