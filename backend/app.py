from flask import (
    Flask,
    url_for,
    render_template,
    make_response,
    jsonify,
    request,
    send_from_directory,
)
from markupsafe import escape
from flask_swagger import swagger
from flask_swagger_ui import get_swaggerui_blueprint


import psycopg2
import os
import requests
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
app.config.SWAGGER_UI_DOC_EXPANSION = "list"
app.config.SWAGGER_UI_OPERATION_ID = True
app.config.SWAGGER_UI_REQUEST_DURATION = True


###############################################################################
# PRIVATE METHOD INTERNAL
###############################################################################
def db_insert(sql):
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
@app.route('/check')
def check():
    return "OK"

@app.route("/test_db")
def db_test():
    # Hard coded the connection string
    conn = psycopg2.connect(connString)

    # close the active session
    conn.close()
    return {"info": "Database connection was successfull"}


@app.route(API_URL)
def spec():
    swag = swagger(app)
    swag["info"]["version"] = "1.0"
    swag["info"]["title"] = "Single Team Project"
    return jsonify(swag)


@app.route("/<path:filename>")
def serve_web_folder(filename):
    return send_from_directory("frontend", filename)


@app.route("/")
def index():
    return make_response(render_template("index.html"))


@app.route("/login.html", methods=["GET", "POST"])
def login():
    return make_response(render_template("html/login.html"))


@app.route("/signup.html", methods=["GET", "POST"])
def signup():
    # if request.method == "POST":
    #     data = jsonify(request.form).get_json()
    #     response = requests.post(request.url_root + "/api/signup", data=data)
    #     # print(request.url_root)
    #     # print(data)
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
            emailAddress:
              type: string
            password:
                type: string
    responses:
        200:
            description: The singup capture user detail
    """
    result = {}
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
        data["passwword"],
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
        data["comment"]
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
    sql = """DELETE public.contacts WHERE id = '{}' """.format(data['id'])

    # perform the query
    status = db_insert(sql)

    return jsonify(status)


###############################################################################
# main driver function
if __name__ == "__main__":
    # run() method of Flask class runs the application
    # on the local development server using port 3308 instead of port 5000.
    app.run(host="0.0.0.0", port=40000)
