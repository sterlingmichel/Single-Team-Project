// People Contact Information
// Team: Single Team
//

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
                $(this).dialog("close");
            }
        }
    });

    return false;
}

function doEdit(refId) {
    $("#dialog-edit").dialog({
        resizable: false,
        height: 860,
        width: 800,
        modal: true,
        title: "Edit contact for refId: " + refId,
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
    const jqxhr = $.ajax("/api/list_contact")
        .done(function (resp) {
            const table = $("#myHomeTable");

            resp.data.forEach((row, x) => {
                const tr = document.createElement('tr');
                const tdcnt = document.createElement('td');
                tdcnt.innerHTML = x + 1;
                tr.appendChild(tdcnt);

                row.forEach((col) => {
                    const td = document.createElement('td');
                    td.innerHTML = col;
                    tr.appendChild(td);
                });

                const tdicon = document.createElement('td');
                tdicon.innerHTML = `
                    <img src="/images/map_icon.png" onclick="doView('${row[4]}')"/>
                `
                tr.appendChild(tdicon);
        
                const tdedit = document.createElement('td');
                tdedit.innerHTML = `
                    <button class="btn edit" onclick="doEdit(${x})">Edit</button>
                    <button class="btn delete" onclick="doDelete(${x})">Delete</button>
                `
                tr.appendChild(tdedit);

                table[0].getElementsByTagName('tbody')[0].appendChild(tr)
            });

            setTimeout(() => {
                $("#myHomeTable").tablesorter();
            }, 100)
        })
        .fail(function () {
            console.log("error");
        });
};



$(document).ready(() => {
    console.log("ready...", location)

    if (location.pathname === '/home.html') {
        home();
    }
});