#!/usr/bin/env sh


export FLASK_APP=app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

python3.11 app.py
