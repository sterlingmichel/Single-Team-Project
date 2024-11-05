# Help generate and document the schema and the methods to be called

Track all the tables schema.

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

# Building each function and query

- login -> /api/login
- methodName: do_login(userName, password)
- sql: Select firstName, lastName Where emailAddress = 'emailAddress' And password = 'password'

- signup -> /api/signup
- methodName: do_signup(firstName, lastName, emailAddress, phoneNumber, comment)
- sql: Insert Into signup
    (firstName, lastName, emailAddress, phoneNumber, comment)
    Values ('firstName', 'lastName', 'emailAddress', 'phoneNumber', 'comment')

- home -> /api/contact/list
- methodName: get_contact_list(None)
- sql: Select
    concact(u.firstName, " ", u.lastName) as userName, c.firstName, c.lastName, c.emailAddress, c.phoneNumber,
    c.address, c.city, c.state, c.zipCode, c.country, c.comment
    from contact c inner join user u ON u.id = c.userId order by c.lastName, c.firstName

- add -> /api/contact/add
- methodName: add_contact(userId, firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
- sql: Insert Into contact
    (userId, firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
    Values ('userId', 'firstName', 'lastName', 'emailAddress', 'phoneNumber', 'address', 'city', 'state', 'zipCode', 'country', 'comment')

- edit -> /api/contact/edit
- methodName: edit_contact(firstName, lastName, emailAddress, phoneNumber, address, city, state, zipCode, country, comment)
- sql: Update contact set
    firstName = 'firstName', lastName = 'lastName', emailAddress = 'emailAddress',
    phoneNumber = 'phoneNumber', address = address, city = 'city', state = 'state',
    zipCode = 'zipCode', country = 'country', comment = 'comment'

# Use case name

- verify login work with valid user name and password
- Description:
- - test the user login page
- - - Pre-conditions:
- - - - User has valid user name and password
- - - - - Test steps:
- - - - - 1. Navigate to /login page
- - - - - 2.User Provide valid userName and password
- - - - - 3.Click login button Expected result: User should be able to login if the enter values are true
