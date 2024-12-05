from flask import (
    Flask,
    url_for,
    render_template,
    make_response,
    jsonify,
    send_from_directory,
)

from flask_swagger import swagger
from flask_swagger_ui import get_swaggerui_blueprint
from flasgger import Swagger, LazyString, LazyJSONEncoder


import psycopg2
import os
from psycopg2.extras import RealDictCursor

# define the connection string
connString = os.environ.get("POSTGRESQL")

name = "Single Team Project"
# create app to use in this Flask application
app = Flask(name, template_folder="frontend")

SWAGGER_URL = "/api/docs"  # URL for exposing Swagger UI (without trailing '/')
API_URL = "/spec"  # Our API url (can of course be a local resource)


# Call factory function to create our blueprint
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,  # Swagger UI static files will be mapped to '{SWAGGER_URL}/dist/'
    API_URL,
    config={"app_name": name},  # Swagger UI config overrides
)

app.register_blueprint(swaggerui_blueprint)
app.config.SWAGGER_UI_DOC_EXPANSION = 'list'
app.config.SWAGGER_UI_OPERATION_ID = True
app.config.SWAGGER_UI_REQUEST_DURATION = True
app.json_encoder = LazyJSONEncoder


@app.route(API_URL)
def spec():
    swag = swagger(app)
    swag["info"]["version"] = "1.0"
    swag["info"]["title"] = "Single Team Project"
    return jsonify(swag)


@app.route("/<path:filename>")
def serve_web_folder(filename):
    return send_from_directory("frontend", filename)


@app.route('/')
def index():
    return make_response(render_template("index.html"))


@app.route("/login.html")
def login():
    return make_response(render_template("html/login.html"))


@app.route("/signup.html")
def signup():
    return make_response(render_template("html/signup.html"))


@app.route("/home.html")
def home():
    return make_response(render_template("html/home.html"))


@app.route("/about.html")
def about():
    return make_response(render_template("html/about.html"))


###############################################################################
# DEFINE ALL THE API
###############################################################################
@app.route("/api/login", methods=["GET"])
def api_login():
    """
        This is login page of the project that capture the user infomation.
        ---
        responses:
            200:
                description: The singup capture user detail
    """
    result = {}
    return jsonify(result)


@app.route("/api/signup", methods=["GET"])
def api_signup():
    """
    This is signup page of the project that capture the user infomation.
    ---
    responses:
        200:
            description: The singup capture user detail
    """
    result = {}
    return jsonify(result)


@app.route("/api/list_contact", methods=["GET"])
def api_list_contact():
    """
        This is home page of the project that display the user infomation.
        ---
        responses:
            200:
                description: The home display all user detail
    """
    result = {
        "data": [
            [
                "Sterling",
                "Michel",
                "sterlingmichel@gmail.com",
                "5166667932",
                "1200 Sunset way erie, co 80516",
                "We met in NY",
            ],
            [
                "Guerdy ",
                "Michel",
                "guerdymichel@gmail.com",
                "2166667932",
                "639 Nostrand way Uniondale, NY 11552",
                "We met in Queens",
            ],
            [
                "Jean ",
                "Carter",
                "jcarter@gmail.com",
                "3146667912",
                "23 Brighton ave Pleasantville, NJ 08232",
                "We met in Atlantic city",
            ],
        ]
    }
    return jsonify(result)


###############################################################################
# main driver function
if __name__ == '__main__':
    # run() method of Flask class runs the application 
    # on the local development server using port 3308 instead of port 5000.
    app.run(host='0.0.0.0', port=40000)
