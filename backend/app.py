"""@package docstring
 This project is designed to demostrate three key features using a range
 of opensource technology like postgres, python, flask and number plugins
 It is created by Sterling Michel for the CS course
"""

from flask import (
    Flask,
    url_for,
    render_template,
    make_response,
    jsonify,
    request,
    send_from_directory,
    session,
)
from markupsafe import escape
from flask_swagger import swagger
from flask_swagger_ui import get_swaggerui_blueprint
from flask_bcrypt import Bcrypt

import psycopg2
import os
import requests
from psycopg2.extras import RealDictCursor

# define the connection string
connString = os.environ.get("POSTGRESQL")

name = "Single Team Project"
# create app to use in this Flask application
app = Flask(name, template_folder="frontend")
app.secret_key = "&N>_*oZW#G]Bj!M/GS=1dX#8r%0Wp+"
bcrypt = Bcrypt(app)

SWAGGER_URL = "/api/docs"  # URL for exposing Swagger UI (without trailing '/')
API_URL = "/spec"  # Our API url (can of course be a local resource)


# Call factory function to create our blueprint
swaggerui_blueprint = get_swaggerui_blueprint(
    SWAGGER_URL,  # Swagger UI static files will be mapped to '{SWAGGER_URL}/dist/'
    API_URL,
    config={"app_name": name},  # Swagger UI config overrides
)

app.register_blueprint(swaggerui_blueprint)
app.config.SWAGGER_UI_DOC_EXPANSION = "list"
app.config.SWAGGER_UI_OPERATION_ID = True
app.config.SWAGGER_UI_REQUEST_DURATION = True


###############################################################################
# PRIVATE METHOD INTERNAL
###############################################################################
def db_insert(sql):
    """
    This function adds insert the data to the db base on the sql input.

    Args:
        sql (str): A series of proper sql insert statment.

    Returns:
        dict: info field with Information about the action and status field tracking state
    """

    # Retrieve Hard coded the connection string in terminal for security
    conn = psycopg2.connect(connString)

    # Establish a cursor
    cur = conn.cursor()

    try:
        # now execute the query
        cur.execute(sql)

        # Save the update
        conn.commit()

        # set the message
        info = "Successfully added record"
        status = True
    except Exception as err:
        info = str(err)
        status = False

    # close the cursor connection
    cur.close()

    # release the db connection
    conn.close()

    return {"info": info, "status": status}


def db_view(sql):
    """
    This function adds select the data from the db base on the sql input.

    Args:
        sql (str): A series of proper sql select statment.

    Returns:
        dict: info field with Information about the action and records field a list of data founds
    """

    # Hard coded the connection string
    conn = psycopg2.connect(connString)

    # Establish a cursor
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # now execute the query
        cur.execute(sql)

        # Query the table
        records = cur.fetchall()

        # set the message
        info = "Successfully fetch record"

        # set the status
        status = True
    except Exception as err:
        info = str(err)
        status = False
        records = []

    # close the cursor connection
    cur.close()

    # release the db connection
    conn.close()

    return {"info": info, "records": records}


###############################################################################
# ROUTE EXPOSE EXTENAL
###############################################################################
@app.route("/check")
def check():
    """
     This is validate that the system is running
    ---
    tags:
     - Health Check
    responses:
        200:
            description: Check if system is up
    """
    """
    This function adds select the data from the db base on the sql input.

    Args:
        sql (str): A series of proper sql select statment.

    Returns:
        dict: info field with Information about the action and records field a list of data founds
    """
    return "OK"


@app.route("/test_db")
def db_test():
    """
     This is validate that the database is running
    ---
    tags:
     - Health Check
    responses:
        200:
            description: Database check if it is up and alive
    """
    """
    This function adds select the data from the db base on the sql input.

    Args:
        None (None): No arg is needed.

    Returns:
        dict: info field with Information about the status of the db
    """
    # Hard coded the connection string
    conn = psycopg2.connect(connString)

    # close the active session
    conn.close()
    return {"info": "Database connection was successfull"}


@app.route(API_URL)
def spec():
    """
    This function show the content of the spec file.

    Args:
        None (None): No input needed.

    Returns:
        dict: return a json of the spec retrieved
    """
    swag = swagger(app)
    swag["info"]["version"] = "1.0"
    swag["info"]["title"] = "Single Team Project"
    swag["info"]["author"] = "Sterling Michel"
    swag["info"]["email"] = "sterlingmichel@gmail.com"
    return jsonify(swag)


@app.route("/<path:filename>")
def serve_web_folder(filename):
    """
    This function adds select the data from the db base on the sql input.

    Args:
        filename (str): capture the filename

    Returns:
        dict: info field with Information about the action and records field a list of data founds
    """
    return send_from_directory("frontend", filename)


@app.route("/")
def index():
    """
    This function show the content of the index file.

    Args:
        None (None): No input needed.

    Returns:
        str: return a html file to be render by the browser
    """
    return make_response(render_template("index.html"))


@app.route("/login.html", methods=["GET", "POST"])
def login():
    """
    This function show the content of the login file.

    Args:
        None (None): No input needed.

    Returns:
        str: return a text of html for the browser
    """
    return make_response(render_template("html/login.html"))


@app.route("/signup.html", methods=["GET", "POST"])
def signup():
    """
    This function show the content of the signup file.

    Args:
        None (None): No input needed.

    Returns:
        dict: return a str html
    """
    return make_response(render_template("html/signup.html"))


@app.route("/home.html")
def home():
    """
    This function show the content of the home file.

    Args:
        None (None): No input needed.

    Returns:
        dict: return a json of the spec retrieved
    """
    return make_response(render_template("html/home.html"))


@app.route("/about.html")
def about():
    """
    This function show the content of the about file.

    Args:
        None (None): No input needed.

    Returns:
        dict: return a str of html
    """
    return make_response(render_template("html/about.html"))


@app.route("/logout.html")
def logout():
    """
    This function show the content of the logout file.

    Args:
        None (None): No input needed.

    Returns:
        str: return a text of html to be rendered
    """
    return make_response(render_template("html/logout.html"))


###############################################################################
# DEFINE ALL THE API
###############################################################################
@app.route("/api/login", methods=["POST"])
def api_login():
    """
    This is login page of the project that capture the user infomation.
    ---
    tags:
     - Initial Route Define
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            emailaddress:
              type: string
            password:
                type: string
    responses:
        200:
            description: The singup capture user detail
    """
    # retrieve the post data from client`
    data = request.get_json()

    # build the sql command to run
    sql = """SELECT "id", "firstName", "lastName", "passwd" from public.users WHERE "emailAddress" = '{}' LIMIT 1""".format(
        data["emailaddress"], data["password"]
    )

    # perform the query
    result = db_view(sql)

    #  validate the enter user password
    is_valid = bcrypt.check_password_hash(
        result["records"][0]["passwd"], data["password"]
    )

    if is_valid:
        user = {
            "status": True,
            "info": "Login was successfull",
            "user": {
                "userId": result["records"][0]["id"],
                "loginName": "{}".format(
                    result["records"][0]["firstName"]
                    + " "
                    + result["records"][0]["lastName"]
                ),
            },
        }
        # store the user information
        session['userInfo'] = user

        return user
    else:
        return {"status": False, "info": "Unable to authenticate the user with the given values"}
    return jsonify(result)


@app.route("/api/signup", methods=["POST"])
def api_signup():
    """
     This is login page of the project that capture the user infomation.
    ---
    tags:
     - Initial Route Define
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            firstname:
              type: string
            lastname:
              type: string
            emailAddress:
              type: string
            phoneNumber:
              type: string
            password:
              type: string
            commentInfo:
                type: string
    responses:
        200:
            description: The singup capture user detail
    """
    # retrieve the post data from client`
    data = request.get_json()

    # build the sql command to run
    sql = """
        INSERT INTO public.users ("firstName", "lastName", "emailAddress", "phoneNumber", "passwd", "commentInfo") 
        VALUES('{}', '{}', '{}', '{}', '{}', '{}')
    """.format(
        data["firstname"],
        data["lastname"],
        data["emailaddress"],
        data["phonenumber"],
        bcrypt.generate_password_hash(data["passwword"]).decode("utf-8"),
        "This is a default comment",
    )

    # perform the query
    status = db_insert(sql)

    return jsonify(status)


@app.route("/api/list_contact", methods=["GET"])
def api_list_contact():
    """
    This is home page of the project that display the user infomation.
    ---
    tags:
     - Initial Route Define
    responses:
        200:
            description: The home display all user detail
    """
    # need to retrieve from session
    userId = 1

    qry = """
        SELECT "id", "userId", "firstName", "lastName", "emailAddress", "phoneNumber", "address", "commentInfo"
        FROM public.contacts
        WHERE "userId" = '{}'
        ORDER BY "lastName"
    
    """.format(
        userId
    )
    # build the query
    data = db_view(qry)

    # set the output
    result = {"data": data}

    return jsonify(result)


@app.route("/api/add_contact", methods=["POST"])
def api_add_contact():
    """
     This is add contact page of the project that capture the user infomation.
    ---
    tags:
     - Initial Route Define
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            firstname:
              type: string
            lastname:
              type: string
            emailAddress:
              type: string
            phoneNumber:
              type: string
            address:
              type: string
            commentInfo:
                type: string
    responses:
        200:
            description: The add contact capture contact detail
    """
    # need to retrieve from session
    userId = 1

    # retrieve the post data from client`
    data = request.get_json()

    # build the sql command to run
    sql = """
        INSERT INTO public.contacts ("userId", "firstName", "lastName", "emailAddress", "phoneNumber", "address", "commentInfo") 
        VALUES('{}', '{}', '{}', '{}', '{}', '{}', '{}')
    """.format(
        userId,
        data["firstname"],
        data["lastname"],
        data["emailaddress"],
        data["phonenumber"],
        data["address"],
        data["comment"],
    )

    # perform the query
    status = db_insert(sql)

    return jsonify(status)


@app.route("/api/edit_contact", methods=["PUT", "POST"])
def api_edit_contact():
    """
     This is edit contact page of the project that capture the user infomation.
    ---
    tags:
     - Initial Route Define
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            id:
              type: string
            firstname:
              type: string
            lastname:
              type: string
            emailAddress:
              type: string
            phoneNumber:
              type: string
            address:
              type: string
            commentInfo:
                type: string
    responses:
        200:
            description: The edit contact capture contact detail
    """
    # need to retrieve from session
    userId = 1

    # retrieve the post data from client`
    data = request.get_json()

    # build the sql command to run
    sql = """
        UPDATE public.contacts 
            userId='{}', 
            firstName='{}', 
            lastName='{},
            emailAddress='{}', 
            phoneNumber='{}', 
            address='{}',
            commentInfo='{}'
    """.format(
        userId,
        data["firstname"],
        data["lastname"],
        data["emailaddress"],
        data["phonenumber"],
        data["address"],
        data["comment"],
    )

    # perform the query
    status = db_insert(sql)

    return jsonify(status)


@app.route("/api/delete_contact", methods=["POST", "DELETE"])
def api_delete_contact():
    """
     This is delete contact page of the project that capture the user infomation.
    ---
    tags:
     - Initial Route Define
    parameters:
      - in: body
        name: body
        schema:
          type: object
          properties:
            id:
              type: string
    responses:
        200:
            description: The delete contact capture contact detail
    """
    
    # need to retrieve from session
    userId = 1

    # retrieve the post data from client`
    data = request.get_json()

    # build the sql command to run
    sql = """DELETE public.contacts WHERE id = '{}' """.format(data["id"])

    # perform the query
    status = db_insert(sql)

    return jsonify(status)


###############################################################################
# main driver function
if __name__ == "__main__":
    # run() method of Flask class runs the application
    # on the local development server using port 3308 instead of port 5000.
    app.run(host="0.0.0.0", port=40000)
