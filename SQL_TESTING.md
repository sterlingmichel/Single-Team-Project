# Help generate and document the schema and the methods to be called

Track all the tables schema.

# What are the tables you are going to have in the database?

- I am going to have three main tables.
- - Users
- - Contacts
- - Trackings

# What are the fields of each table?

- The fields of each table are:
Users => id,firstName,lastName,emailAddress,phoneNumber,comment
Contacts => id,firstName,lastName,emailAddress,phoneNumber,address,city,state,zipCode,country,comment
Trackings => id,userId,contactId,trackDate,comment

# What are the constraints for those table fields?

On all three tables i have the the id fields as autoNumber and not null
On the trackings table i have userId and contactId as integer foreignKey constraint

# What are the relationships between tables?

Users table has a One-To-Many with Contacts
Trackings table has Many-To-Many with Contacts and Many-To-Many with Users
Contacts table has Many-To-One with Users

# What are the functions that will be created to access the database?

- methodName: do_signup(firstName, lastName, emailAddress, phoneNumber, comment)
- methodName: do_login(userName, password)
- methodName: add_contact(userId, firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
- methodName: edit_contact(firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
- methodName: get_contact_by(contactId)
- methodName: get_contact_list()

# What are the tests to make sure those access routines work?

1. When i hit the route "/api/login" and provide a valid username and password, i expect a dataset of the information
2. when i hit the route "/api/signup" and provide the user detail like first, last and other i expect detail of the user like first
3. when i hit the route "/api/contact/add" and provide all the detail, i expect an auto generate id


## Database tables, Function & SQL

# Users

Desc: The "users" table will be use to capture the login user information so that we know who each person are.
Columns:

- id => automaticly index counter
- firstName => Capture the login first name
- lastName =>  Capture the login last name
- emailAddress => Capture the login email, this will also be use as the user name to login
- phoneNumber => Optional field to get the login phone
- comment => Optional field that will provide further information about the use

# Contacts

Desc: The "contacts" table will be use to capture the contact detail information to help track all the organize.
Columns:

- id => automaticly index counter
- userId => Reference to the users table to know who created it
- firstName => Capture the login first name
- lastName =>  Capture the login last name
- emailAddress => Capture the login email, this will also be use as the user name to login
- phoneNumber => Optional field to get the login phone
- address =>  Store the contact address information
- city => Store the city
- zipCode => Store the zipcode
- country => Store the country
- comment => Optional field that will provide where we met and other detail

# Trackings

Desc: The "trackings" table will be use to store the each time the contact was share.
Columns:

- id => automaticly index counter
- userId => Reference to the users table to know who created it
- contactId => Reference to the contacts table to know who which contact was shared
- trackDate => Capture the tracking date
- comment => Optional field that will provide where we met and other detail

# Building each route and query

- route: login -> /api/login
- sql: Select firstName, lastName Where emailAddress = 'emailAddress' And password = 'password'

- signup -> /api/signup
- sql: Insert Into signup
    (firstName, lastName, emailAddress, phoneNumber, comment) Values ('firstName', 'lastName', 'emailAddress', 'phoneNumber', 'comment')

- route: list_contact -> /api/contact/list
- sql: Select
    concact(u.firstName, " ", u.lastName) as userName, c.firstName, c.lastName, c.emailAddress, c.phoneNumber,
    c.address, c.city, c.state, c.zipCode, c.country, c.comment
    from contact c inner join user u ON u.id = c.userId order by c.lastName, c.firstName

- route: add_contact -> /api/contact/add
- sql: Insert Into contact
    (userId, firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
    Values ('userId', 'firstName', 'lastName', 'emailAddress', 'phoneNumber', 'address', 'city', 'state', 'zipCode', 'country', 'comment')

- route: edit_contact -> /api/contact/edit
- sql: Update contact set
    firstName = 'firstName', lastName = 'lastName', emailAddress = 'emailAddress',
    phoneNumber = 'phoneNumber', address = address, city = 'city', state = 'state',
    zipCode = 'zipCode', country = 'country', comment = 'comment'
