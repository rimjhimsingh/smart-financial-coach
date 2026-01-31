"""
Application Entry Point
-----------------------
This script serves as the Entry Point for the application.
"""
from src import create_app
from dotenv import load_dotenv
load_dotenv()



app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5001)
