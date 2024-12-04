from flask import (
    Flask,
    url_for,
    render_template,
    make_response,
    render_template,
    jsonify,
)
from flask_swagger import swagger
import psycopg2
import os
from psycopg2.extras import RealDictCursor
import prefix

# define the connection string
connString = os.environ.get("POSTGRESQL")

# create app to use in this Flask application
app = Flask(__name__)

# Insert the wrapper for handling PROXY when using csel.io virtual machine
# Calling this routine will have no effect if running on local machine
prefix.use_PrefixMiddleware(app)   



@app.route("/spec")
def spec():
    swag = swagger(app)
    swag["info"]["version"] = "1.0"
    swag["info"]["title"] = "Single Team Project"
    return jsonify(swag)


@app.route('/')
def index():
    pass


@app.route("/about")
def about():
    return make_response(render_template("about.html"))


###############################################################################
# main driver function
if __name__ == '__main__':
    # run() method of Flask class runs the application 
    # on the local development server using port 3308 instead of port 5000.
    app.run(host='0.0.0.0', port=40000)
