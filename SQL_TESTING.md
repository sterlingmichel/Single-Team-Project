
## Users

Desc: The "users" table will be use to capture the login user information so that we know who each person are.
Columns:
    - id => automaticly index counter
    - firstName => Capture the login first name
    - lastName =>  Capture the login last name
    - emailAddress => Capture the login email, this will also be use as the user name to login
    - phoneNumber => Optional field to get the login phone
    - comment => Optional field that will provide further information about the use

## Contacts

Desc: The "contacts" table will be use to capture the contact detail information to help track all the organize.
Columns:
    - id => automaticly index counter
    - userId => Reference to the users table to know who created it
    - firstName => Capture the login first name
    - lastName =>  Capture the login last name
    - emailAddress => Capture the login email, this will also be use as the user name to login
    - phoneNumber => Optional field to get the login phone
    - address =>  Store the contact address information
    - zipCode => Store the zipcode
    - country => Store the country
    - comment => Optional field that will provide where we met and other detail


