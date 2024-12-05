// People Contact Information
// Team: Single Team
//

// helper method
$.fn.serializeObject = function () {
    var o = {};
    //    var a = this.serializeArray();
    $(this).find('textarea, input[type="hidden"], input[type="text"], input[type="password"], input[type="checkbox"]:checked, input[type="radio"]:checked, select').each(function () {
        if ($(this).attr('type') == 'hidden') { //if checkbox is checked do not take the hidden field
            var $parent = $(this).parent();
            var $chb = $parent.find('input[type="checkbox"][name="' + this.name.replace(/\[/g, '\[').replace(/\]/g, '\]') + '"]');
            if ($chb != null) {
                if ($chb.prop('checked')) return;
            }
        }
        if (this.name === null || this.name === undefined || this.name === '')
            return;
        var elemValue = null;
        if ($(this).is('select'))
            elemValue = $(this).find('option:selected').val();
        else elemValue = this.value;
        if (o[this.name] !== undefined) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(elemValue || '');
        } else {
            o[this.name] = elemValue || '';
        }
    });
    return o;
}


function doEdit(rowData) {
    $("#dialog-edit").dialog({
        resizable: false,
        height: 860,
        width: 800,
        modal: true,
        title: "Edit contact",
        open: function() {
            // capture the form input
            const form = $("#editContact")
            // const formData = form.serializeObject();


            // const gridTrData = $('#myHomeTable tbody tr');
            console.log("===", rowData)

            // $(this)
            //     .find('textarea, input[type="hidden"], input[type="text"], input[type="password"], input[type="checkbox"]:checked, input[type="radio"]:checked, select')
            //     .each(function () {
            //         console.log(this.name)

            //     });

        },
        buttons: {
            Cancel: function () {
                $(this).dialog("close");
            },
            Save: function () {
               
                $(this).dialog("close");
            }
        }
    });

    return false;
}

function doDelete(refId) {
    $("#dialog-confirm").dialog({
        resizable: false,
        height: "auto",
        width: 400,
        modal: true,
        title: "Deleting contact",
        buttons: {
            Delete: function () {
                $(this).dialog("close");
            },
            Cancel: function () {
                $(this).dialog("close");
            }
        }
    });

    return false;
}

function doView(address) {
    const url = "https://maps.google.com/maps?f=q&source=s_q&hl=en&geocode=&q=" + address + "&aq=&ie=UTF8&hq=" + address + "&output=embed";
    $('#addressLocation').attr('src', url);

    $("#dialog-view").dialog({
        resizable: false,
        height: 600,
        width: 800,
        title: "Show Address in the Google map",
        modal: true,
    });

    return false;
}

function home() {
    $.ajax("/api/list_contact")
        .done(function (resp) {

            // get dom referent to table
            const table = $("#myHomeTable");

            // get dom reference for tbody
            const tbody = table[0].getElementsByTagName('tbody')[0];
            tbody.innerHTML = "";

            resp.data.records.forEach((row, x) => {
                const tr = document.createElement('tr');
                const tdcnt = document.createElement('td');
                tdcnt.innerHTML = x + 1;
                tr.appendChild(tdcnt);

                ['firstName', 'lastName', 'emailAddress', 'phoneNumber', 'address', 'commentInfo']
                    .forEach((col) => {
                        const td = document.createElement('td');
                        td.innerHTML = row[col];
                        tr.appendChild(td);
                    });

                const tdicon = document.createElement('td');
                tdicon.innerHTML = `
                    <img src="/images/map_icon.png" onclick="doView('row['address']}')"/>
                `
                tr.appendChild(tdicon);

                const tdedit = document.createElement('td');
                tdedit.innerHTML = `
                    <button class="btn edit" onclick="doEdit('${JSON.stringify(row)}')">Edit</button>
                    <button class="btn delete" onclick="doDelete(row['id'])">Delete</button>
                `
                tr.appendChild(tdedit);

                // push the row data
                tbody.appendChild(tr)
            });

            setTimeout(() => {
                $("#myHomeTable").tablesorter();
            }, 100)
        })
        .fail(function () {
            console.log("error");
        });
};

function doSignup(f) {
    const formData = $(f).serializeObject();
    $.ajax({
        contentType: "application/json",
        type: "POST",
        url: "/api/signup",
        data: JSON.stringify(formData),
        success: function (response) {
            // Handle the response from the server
            $('#msg')[0].innerHTML = response.info;

            // clear the screen
            if (response.status) {
                f.reset();
            }
        }
    });


    return false;
}

function addContact() {
    $("#dialog-create").dialog({
        resizable: false,
        height: 860,
        width: 800,
        modal: true,
        title: "Add new contact",
        buttons: {
            Cancel: function () {
                $(this).dialog("close");
            },
            Save: function () {
                const self = $(this);

                // capture the form input
                const form = $("#createContact")
                const formData = form.serializeObject();

                $.ajax({
                    contentType: "application/json",
                    type: "POST",
                    url: "/api/add_contact",
                    data: JSON.stringify(formData),
                    success: function (response) {
                        // // Handle the response from the server
                        // $('#msg')[0].innerHTML = response.info;

                        // clear the screen
                        if (response.status) {
                            form[0].reset();
                            home();
                            self.dialog("close");
                        }
                    }
                });
            }
        }
    });

    return false;
}


$(document).ready(() => {
    if (location.pathname === '/home.html') {
        home();
    }
});