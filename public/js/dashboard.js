document.addEventListener('DOMContentLoaded', () => {
    // Intercept fetch to add JWT token
    const originalFetch = window.fetch;
    window.fetch = function() {
        let [resource, config] = arguments;
        if(config === undefined) {
            config = {};
        }
        if(config.headers === undefined) {
            config.headers = {};
        }
        const token = localStorage.getItem('token');
        if (token && !config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return originalFetch.call(window, resource, config);
    };

    // Only initialize chart if the canvas exists (we are on dashboard)
    const ctx = document.getElementById('revenueChart');
    if (ctx) {
        initChart(ctx);
        initDashboardLogic();
    }
});

function initDashboardLogic() {
    const navItems = document.querySelectorAll('.nav-item[data-target]');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Tab Switching
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active classes
            navItems.forEach(nav => nav.classList.remove('active'));
            tabContents.forEach(tab => tab.classList.remove('active'));
            
            // Add active class to clicked item and target tab
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            const targetTab = document.getElementById(targetId);
            if(targetTab) {
                targetTab.classList.add('active');
            }
            
            // On mobile, close sidebar after clicking a link
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('active');
            }
        });
    });

    // Logout Handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                localStorage.removeItem('name');
                localStorage.removeItem('email');
                window.location.href = 'index.html';
            }
        });
    }

    // Mobile Sidebar Toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // Role Based UI Logic
    const rawRole = localStorage.getItem('role') || 'Tenant';
    const role = rawRole.toLowerCase();
    const isTenant = role === 'tenant';
    const isLandlord = role === 'landlord';
    const isAdmin = role === 'admin';
    const isManager = role === 'property manager';
    
    // Display name or role
    document.getElementById('userRoleDisplay').innerText = localStorage.getItem('name') || rawRole;

    if (isAdmin) {
        const adminNav = document.getElementById('adminNav');
        if(adminNav) adminNav.style.display = 'flex';
    }

    if (isTenant) {
        document.getElementById('addPropertyBtn').style.display = 'none';
        document.getElementById('addPaymentBtn').style.display = 'none';
        const bNav = document.getElementById('bookingsNav');
        if(bNav) bNav.style.display = 'none';
        const raiseBtn = document.getElementById('raiseIssueBtn');
        if(raiseBtn) raiseBtn.style.display = 'inline-block';
        const landlordCol = document.querySelector('.landlord-only-col');
        if(landlordCol) landlordCol.style.display = 'none';
        
        // Tenant view overrides
        const landlordTenants = document.getElementById('landlordTenantsView');
        if(landlordTenants) landlordTenants.style.display = 'none';
        const tenantDetails = document.getElementById('tenantDetailsView');
        if(tenantDetails) tenantDetails.style.display = 'block';
        
        const tenantFilters = document.getElementById('tenantPropertyFilters');
        if(tenantFilters) tenantFilters.style.display = 'block';
        
    } else if (isLandlord || isManager) {
        const bNav = document.getElementById('bookingsNav');
        if(bNav) bNav.style.display = 'flex';
        const oBk = document.getElementById('overviewBookingsContainer');
        if(oBk) oBk.style.display = 'block';
        const oMaint = document.getElementById('overviewMaintenanceContainer');
        if(oMaint) oMaint.style.display = 'block';
    }

    async function fetchData() {
        try {
            await window.loadProperties();

            if (isAdmin) {
                const pendRes = await fetch('/api/users/pending');
                if(pendRes.ok) {
                    const pendingUsers = await pendRes.json();
                    renderPendingUsers(pendingUsers);
                }
            }

            const payRes = await fetch('/api/payments');
            const payments = await payRes.json();
            renderPayments(payments);
            renderDataPayments(payments);

            const bookRes = await fetch('/api/bookings');
            let bookings = await bookRes.json();
            
            if (isLandlord || isManager) {
                renderBookings(bookings);
                renderTenants(bookings, payments);
            }

            const userName = localStorage.getItem('name') || '';
            const maintRes = await fetch(`/api/maintenance?role=${role}&tenantName=${encodeURIComponent(userName)}`);
            let maintenance = await maintRes.json();
            
            if (isTenant) {
                const userEmail = (localStorage.getItem('email') || '').toLowerCase();
                const userNameLower = userName.toLowerCase();
                maintenance = maintenance.filter(m => {
                    const emailLower = (m.tenantEmail || '').toLowerCase();
                    const nameLower = (m.tenantName || '').toLowerCase();
                    return emailLower === userEmail || nameLower === userNameLower;
                });
            }
            renderMaintenance(maintenance);

            if (isTenant) {
                renderTenantDetails(bookings, payments);
                renderTenantBookings(bookings);
                renderTenantPayments(payments);
                renderTenantMaintenance(maintenance);
            }

            const propRes = await fetch('/api/properties');
            const properties = await propRes.json();
            
            // Calculate stats
            updateStats(properties, payments, bookings, maintenance);
        } catch (err) {
            console.error('Error fetching data', err);
        }
    }

    window.loadProperties = async function() {
        try {
            const propRes = await fetch('/api/properties');
            let properties = await propRes.json();
            
            // Apply Filters if tenant
            if (isTenant) {
                const maxRent = document.getElementById('filterMaxRent').value;
                const type = document.getElementById('filterType').value;
                const amenities = document.getElementById('filterAmenities').value.toLowerCase();
                
                if (maxRent) {
                    properties = properties.filter(p => p.rent <= parseFloat(maxRent));
                }
                if (type) {
                    properties = properties.filter(p => p.type === type);
                }
                if (amenities) {
                    properties = properties.filter(p => {
                        const allTxt = ((p.title||'') + (p.amenities ? p.amenities.join(' ') : '') + (p.facilities ? p.facilities.join(' ') : '')).toLowerCase();
                        return allTxt.includes(amenities);
                    });
                }
            }
            
            renderProperties(properties);
            renderDataProperties(properties);
        } catch (err) {
            console.error(err);
        }
    };

    window.approveUser = async function(id) {
        try {
            const res = await fetch(`/api/users/approve/${id}`, { method: 'PUT' });
            if(res.ok) location.reload();
            else alert('Failed to approve user');
        } catch(err) {
            alert('Error approving user');
        }
    };

    function renderPendingUsers(users) {
        const tbody = document.getElementById('pendingUsersTableBody');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No pending users</td></tr>';
            return;
        }
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td><span class="status-badge status-pending">${u.role}</span></td>
                <td><button class="btn btn-primary" style="padding:0.25rem 0.75rem; font-size:0.75rem;" onclick="approveUser('${u._id}')">Approve</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    // Add Property Logic
    const addPropertyForm = document.getElementById('addPropertyForm');
    if (addPropertyForm) {
        addPropertyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.innerText = 'Saving...';
            
            const payload = {
                title: document.getElementById('propTitle').value,
                rent: document.getElementById('propRent').value,
                type: document.getElementById('propType').value,
                image: document.getElementById('propImage').value,
                available: true
            };

            try {
                // Try remote saving first
                const res = await fetch('/api/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    document.getElementById('propertyModal').style.display = 'none';
                    e.target.reset();
                    alert('Property Added Successfully!');
                    btn.innerText = 'Save Property';
                    location.reload();
                } else {
                    alert('Error saving property. Please try again.');
                    btn.innerText = 'Save Property';
                }
            } catch (err) {
                console.error('Property save error:', err);
                alert('Error: Could not save property');
                btn.innerText = 'Save Property';
            }
        });
    }

    // Add Payment Logic
    const addPaymentForm = document.getElementById('addPaymentForm');
    if (addPaymentForm) {
        addPaymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                tenant: document.getElementById('payTenant').value,
                tenantEmail: document.getElementById('payTenant').value,
                propertyTitle: document.getElementById('payProperty').value || '',
                totalRent: parseFloat(document.getElementById('payTotalRent').value || 0),
                amount: parseFloat(document.getElementById('payAmount').value),
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                status: document.getElementById('payStatus').value
            };
            
            try {
                const res = await fetch('/api/payments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    document.getElementById('paymentModal').style.display = 'none';
                    e.target.reset();
                    alert('Payment Recorded Successfully!');
                    location.reload();
                } else {
                    alert('Error recording payment');
                }
            } catch (err) {
                console.error('Payment error:', err);
                alert('Error: Could not record payment');
            }
        });
    }

    // Add Booking Logic
    const addBookingForm = document.getElementById('addBookingForm');
    if (addBookingForm) {
        addBookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const rentAmount = parseFloat(document.getElementById('bookRentAmount').value || 0);
            const paidAmount = parseFloat(document.getElementById('bookPaidAmount').value || 0);
            const pendingAmount = rentAmount - paidAmount;
            
            const payload = {
                propertyId: document.getElementById('bookPropertyId').value,
                propertyTitle: document.getElementById('bookPropertyTitle').value,
                tenantName: document.getElementById('bookTenantName').value,
                tenantEmail: document.getElementById('bookTenantEmail').value,
                tenantPhone: document.getElementById('bookTenantPhone').value,
                leaseStartDate: document.getElementById('bookLeaseStartDate').value,
                leaseEndDate: document.getElementById('bookLeaseEndDate').value,
                rentAmount: rentAmount,
                paidAmount: paidAmount,
                pendingAmount: pendingAmount,
                status: 'Pending',
                paymentStatus: paidAmount > 0 ? 'Pending' : 'Pending'
            };

            try {
                const res = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    document.getElementById('bookingModal').style.display = 'none';
                    e.target.reset();
                    alert('Property Booked Successfully! Waiting for landlord approval.');
                    location.reload();
                } else {
                    alert('Error: Could not submit booking. Please try again.');
                }
            } catch (err) {
                console.error('Booking error:', err);
                alert('Could not book property. ' + err.message);
            }
        });
    }

    // Raise Issue Logic
    const raiseIssueForm = document.getElementById('raiseIssueForm');
    if (raiseIssueForm) {
        raiseIssueForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {
                propertyTitle: document.getElementById('issuePropertyId').value,
                issue: document.getElementById('issueSummary').value,
                description: document.getElementById('issueDescription').value,
                tenantName: localStorage.getItem('name') || 'Unknown',
                tenantEmail: localStorage.getItem('email') || '',
                status: 'Pending'
            };

            try {
                const res = await fetch('/api/maintenance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    document.getElementById('raiseIssueModal').style.display = 'none';
                    e.target.reset();
                    alert('Maintenance Issue Raised Successfully!');
                    location.reload();
                } else {
                    alert('Error: Server returned status ' + res.status + '. Did you restart the server?');
                }
            } catch (err) {
                alert('Could not raise issue. Error: ' + err.message + '. Please ensure the server is running.');
            }
        });
    }

    // Load initial data now that all functions and event listeners are initialized
    fetchData();
}

function renderProperties(props) {
    const tbody = document.getElementById('propertiesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    props.forEach(appendProperty);
}

function appendProperty(prop) {
    const tbody = document.getElementById('propertiesTableBody');
    if(!tbody) return;
    const tr = document.createElement('tr');
    
    const rawRole = localStorage.getItem('role') || 'Tenant';
    const role = rawRole.toLowerCase();
    const imageHtml = prop.image ? `<img src="${prop.image}" alt="${prop.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 'No Image';
    const toggleHtml = role === 'landlord' ? `<button class="btn btn-outline" style="padding:0.25rem 0.75rem; font-size:0.75rem;" onclick="toggleStatus('${prop._id || prop.id}', ${prop.available})">Toggle Status</button>` : '';
    const deleteHtml = role === 'landlord' ? `<button class="btn btn-danger" style="padding:0.25rem 0.75rem; font-size:0.75rem; margin-left: 0.5rem;" onclick="deleteProperty('${prop._id || prop.id}')">Delete</button>` : '';
    const safeTitle = (prop.title || '').replace(/'/g, "\\'");
    const bookHtml = role === 'tenant' && prop.available ? `<button class="btn btn-primary" style="padding:0.25rem 0.75rem; font-size:0.75rem;" onclick="openBookingModal('${prop._id || prop.id}', '${safeTitle}', ${prop.rent || 0})">Book Now</button>` : '';

    tr.innerHTML = `
        <td>${prop.title}</td>
        <td>${prop.type}</td>
        <td>${imageHtml}</td>
        <td>$${prop.rent}/mo</td>
        <td>
            <span class="status-badge ${prop.available ? 'status-paid' : 'status-pending'}">${prop.available ? 'Vacant' : 'Occupied'}</span>
        </td>
        <td>
            ${toggleHtml} ${deleteHtml} ${bookHtml}
        </td>
    `;
    tbody.appendChild(tr);
}

window.toggleStatus = async function(id, currentStatus) {
    try {
        await fetch(`/api/properties/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ available: !currentStatus })
        });
        location.reload(); // Refresh to show new status
    } catch (e) {
        console.error(e);
        alert('Could not update status');
    }
}

window.deleteProperty = async function(id) {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
        await fetch(`/api/properties/${id}`, {
            method: 'DELETE'
        });
        location.reload(); // Refresh to show updated list
    } catch (e) {
        console.error(e);
        alert('Could not delete property');
    }
}

function renderPayments(payments) {
    const tbody = document.getElementById('paymentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    payments.forEach(appendPayment);
}

function appendPayment(pay) {
    const tbody = document.getElementById('paymentsTableBody');
    if(!tbody) return;
    const badgeClass = pay.status === 'Resolved' ? 'status-paid' : (pay.status === 'Completed' ? 'status-paid' : (pay.status === 'Processing' ? 'status-pending' : 'status-overdue'));
    const tr = document.createElement('tr');
    
    const pendingBalance = (pay.totalRent || 0) - (pay.amount || 0);
    
    tr.innerHTML = `
        <td>${pay.tenant}</td>
        <td>${pay.propertyTitle || 'N/A'}</td>
        <td>$${pay.totalRent || 0}</td>
        <td>$${pay.amount || 0}</td>
        <td>$${pendingBalance > 0 ? pendingBalance.toFixed(2) : 0}</td>
        <td>
            <select onchange="updatePaymentStatusDirect('${pay._id}', this.value)" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                <option value="${pay.status || 'Pending'}">${pay.status || 'Pending'}</option>
                <option value="Pending">Pending</option>
                <option value="Resolved">Resolved</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
            </select>
        </td>
        <td>${pay.date || 'N/A'}</td>
        <td>
            <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deletePayment('${pay._id}')">Delete</button>
        </td>
    `;
    tbody.appendChild(tr);
}

function renderDataProperties(props) {
    const tbody = document.getElementById('dataPropertiesTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    props.forEach(prop => {
        const tr = document.createElement('tr');
        const imageHtml = prop.image ? `<img src="${prop.image}" alt="${prop.title}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 'No Image';
        tr.innerHTML = `
            <td>${prop._id || prop.id}</td>
            <td>${prop.title}</td>
            <td>${prop.type}</td>
            <td>${imageHtml}</td>
            <td>$${prop.rent}</td>
            <td>${prop.available ? 'Yes' : 'No'}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderDataPayments(payments) {
    const tbody = document.getElementById('dataPaymentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    payments.forEach(pay => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pay._id || pay.id}</td>
            <td>${pay.tenant}</td>
            <td>$${pay.amount}</td>
            <td>${pay.date}</td>
            <td>${pay.status}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderBookings(bookings) {
    const tbody = document.getElementById('bookingsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    bookings.forEach(booking => {
        const tr = document.createElement('tr');
        const statusClass = booking.status === 'Approved' ? 'status-paid' : (booking.status === 'Rejected' ? 'status-overdue' : 'status-pending');
        const paymentStatusClass = booking.paymentStatus === 'Resolved' ? 'status-paid' : 'status-pending';
        
        tr.innerHTML = `
            <td>${booking.propertyTitle}</td>
            <td>${booking.tenantName}</td>
            <td>${booking.tenantEmail}</td>
            <td>${booking.tenantPhone}</td>
            <td>${booking.leaseStartDate || ''}</td>
            <td>${booking.leaseEndDate || ''}</td>
            <td>$${booking.rentAmount || 0}</td>
            <td>
                <select onchange="updatePaymentStatus('${booking._id}', this.value)" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                    <option value="${booking.paymentStatus || 'Pending'}">${booking.paymentStatus || 'Pending'}</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                </select>
            </td>
            <td><span class="status-badge ${statusClass}">${booking.status}</span></td>
            <td>
                <select onchange="updateBookingStatus('${booking._id}', this.value)" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc; margin-right: 0.5rem; font-size:0.85rem;">
                    <option value="">Update</option>
                    <option value="Approved">Approve</option>
                    <option value="Rejected">Reject</option>
                    <option value="Pending">Pending</option>
                </select>
                <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deleteBooking('${booking._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTenants(bookings, payments) {
    const tbody = document.getElementById('tenantsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    // Only show tenants that have approved bookings
    const approvedBookings = bookings.filter(b => b.status === 'Approved');
    if (approvedBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No active tenants found.</td></tr>';
        return;
    }
    
    approvedBookings.forEach(booking => {
        const tenantEmailLower = (booking.tenantEmail || '').toLowerCase();
        // find their latest payment status
        const theirPayments = payments.filter(p => (p.tenant || '').toLowerCase() === tenantEmailLower);
        const lastPayment = theirPayments.length > 0 ? theirPayments[theirPayments.length - 1] : null;
        
        const payStatus = lastPayment ? lastPayment.status : 'No Payments';
        const payBadgeClass = payStatus === 'Completed' ? 'status-paid' : (payStatus === 'Processing' ? 'status-pending' : 'status-overdue');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${booking.tenantName || 'Unknown'}</td>
            <td>${booking.propertyTitle || 'Unknown'}</td>
            <td>${booking.leaseStartDate || 'N/A'}</td>
            <td>${booking.leaseEndDate || 'N/A'}</td>
            <td><span class="status-badge ${payBadgeClass}">${payStatus}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTenantBookings(bookings) {
    const tbody = document.getElementById('tenantBookingsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const userEmail = (localStorage.getItem('email') || '').toLowerCase();
    const filtered = bookings.filter(booking => booking.tenantEmail && booking.tenantEmail.toLowerCase() === userEmail);
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">You have not made any bookings yet.</td></tr>';
        return;
    }
    filtered.forEach(booking => {
        const statusClass = booking.status === 'Approved' ? 'status-paid' : (booking.status === 'Rejected' ? 'status-overdue' : 'status-pending');
        const paymentStatusClass = booking.paymentStatus === 'Resolved' ? 'status-paid' : 'status-pending';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${booking.propertyTitle}</td>
            <td>${booking.leaseStartDate || ''}</td>
            <td>${booking.leaseEndDate || ''}</td>
            <td>$${booking.rentAmount || 0}</td>
            <td><span class="status-badge ${paymentStatusClass}">${booking.paymentStatus || 'Pending'}</span></td>
            <td><span class="status-badge ${statusClass}">${booking.status}</span></td>
            <td>
                <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deleteBooking('${booking._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openBookingModal = function(propertyId, propertyTitle, rentAmount) {
    const userEmail = localStorage.getItem('email') || '';
    const userName = localStorage.getItem('name') || '';
    document.getElementById('bookPropertyId').value = propertyId;
    document.getElementById('bookPropertyTitle').value = propertyTitle;
    document.getElementById('bookRentAmount').value = rentAmount || 0;
    document.getElementById('bookTenantEmail').value = userEmail;
    document.getElementById('bookTenantName').value = userName;
    document.getElementById('bookingModal').style.display = 'flex';
}

window.updateBookingStatus = async function(bookingId, status) {
    if (!status) return;
    try {
        await fetch(`/api/bookings/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        });
        location.reload();
    } catch (e) {
        console.error(e);
        alert('Could not update booking status');
    }
}

window.deleteBooking = async function(bookingId) {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) return;
    try {
        const res = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE'
        });
        if (res.ok || res.status === 204) {
            alert('Booking deleted successfully');
            location.reload();
        } else {
            alert('Could not delete booking');
        }
    } catch (e) {
        console.error(e);
        alert('Could not delete booking: ' + e.message);
    }
}

window.updatePaymentStatus = async function(bookingId, status) {
    if (!status) return;
    try {
        await fetch(`/api/bookings/${bookingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: status })
        });
        location.reload();
    } catch (e) {
        console.error(e);
        alert('Could not update payment status');
    }
}

window.updatePaymentStatusDirect = async function(paymentId, status) {
    if (!status) return;
    try {
        const res = await fetch(`/api/payments/${paymentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        });
        if (res.ok) {
            alert('Payment status updated successfully');
            location.reload();
        } else {
            alert('Could not update payment status');
        }
    } catch (e) {
        console.error(e);
        alert('Could not update payment status: ' + e.message);
    }
}

window.deletePayment = async function(paymentId) {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
        const res = await fetch(`/api/payments/${paymentId}`, {
            method: 'DELETE'
        });
        if (res.ok || res.status === 204) {
            alert('Payment deleted successfully');
            location.reload();
        } else {
            alert('Could not delete payment');
        }
    } catch (e) {
        console.error(e);
        alert('Could not delete payment: ' + e.message);
    }
}

function renderMaintenance(maintenance) {
    const tbody = document.getElementById('maintenanceTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const rawRole = localStorage.getItem('role') || 'Tenant';
    const role = rawRole.toLowerCase();
    const canEdit = role === 'landlord' || role === 'property manager' || role === 'admin';

    maintenance.forEach(req => {
        const tr = document.createElement('tr');
        const statusClass = req.status === 'Completed' ? 'status-paid' : (req.status === 'Processing' ? 'status-pending' : 'status-overdue');
        
        let actionHtml = '';
        if (canEdit) {
            actionHtml = `
                <td>
                    <select onchange="updateMaintenanceStatus('${req._id}', this.value)" style="padding:0.5rem; border-radius:4px; border:1px solid #ccc; background:rgba(255,255,255,0.1); color:white; font-size:0.85rem;">
                        <option value="${req.status || 'Pending'}" selected>${req.status || 'Pending'}</option>
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Completed">Completed</option>
                    </select>
                </td>
            `;
        }

        const issueLower = (req.issue || '').toLowerCase();
        let iconSvg = '';
        if (issueLower.includes('water') || issueLower.includes('plumb') || issueLower.includes('leak')) {
            iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>';
        } else if (issueLower.includes('electric') || issueLower.includes('power') || issueLower.includes('light')) {
            iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
        } else if (issueLower.includes('clean') || issueLower.includes('trash') || issueLower.includes('pest')) {
            iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        } else {
            iconSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
        }

        tr.innerHTML = `
            <td>${req.propertyTitle}</td>
            <td>${req.tenantName}</td>
            <td style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="background: rgba(255,255,255,0.1); padding: 0.5rem; border-radius: 8px;">${iconSvg}</div>
                <div>
                    <strong>${req.issue}</strong><br>
                    <small style="color:#94a3b8">${req.description || ''}</small>
                </div>
            </td>
            <td><span class="status-badge ${statusClass}">${req.status}</span></td>
            ${actionHtml}
        `;
        tbody.appendChild(tr);
    });
}

window.updateMaintenanceStatus = async function(id, status) {
    if (!status) return;
    try {
        await fetch(`/api/maintenance/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: status })
        });
        location.reload();
    } catch (e) {
        console.error(e);
        alert('Could not update status');
    }
}

function renderTenantDetails(bookings, payments) {
    const grid = document.getElementById('myLeaseGrid');
    if(!grid) return;
    
    // Find the current tenant's booking using their email
    const userEmail = (localStorage.getItem('email') || '').toLowerCase();
    const myBookings = bookings.filter(b => b.tenantEmail && b.tenantEmail.toLowerCase() === userEmail);
    const myBooking = myBookings.length > 0 ? myBookings[myBookings.length - 1] : null;
    
    const myPayments = payments.filter(p => {
        const tenantLower = (p.tenant || '').toLowerCase();
        return tenantLower === userEmail || (myBooking && tenantLower === (myBooking.tenantEmail || '').toLowerCase());
    });
    const lastPayment = myPayments.length > 0 ? myPayments[myPayments.length - 1] : null;

    if (!myBooking) {
        grid.innerHTML = '<p style="grid-column: 1 / -1; color: #94a3b8;">You have not booked any properties yet.</p>';
        return;
    }

    const payStatusHtml = lastPayment 
        ? `<span class="status-badge ${lastPayment.status === 'Completed' ? 'status-paid' : 'status-pending'}">${lastPayment.status}</span>`
        : `<button class="btn btn-primary" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;" onclick="document.getElementById('paymentModal').style.display='flex'">Pay Now</button>`;

    grid.innerHTML = `
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Tenant Email</span>
            <span class="stat-value" style="font-size:1.2rem;">${myBooking.tenantEmail}</span>
        </div>
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Current Lease</span>
            <span class="stat-value" style="font-size:1.5rem;">${myBooking.propertyTitle}</span>
        </div>
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Lease Start</span>
            <span class="stat-value" style="font-size:1.2rem;">${myBooking.leaseStartDate || 'N/A'}</span>
        </div>
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Lease End</span>
            <span class="stat-value" style="font-size:1.2rem;">${myBooking.leaseEndDate || 'N/A'}</span>
        </div>
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Rent Amount</span>
            <span class="stat-value" style="font-size:1.5rem;">$${myBooking.rentAmount || 0}</span>
        </div>
        <div class="stat-card glass-panel" style="background:rgba(255,255,255,0.05);">
            <span class="stat-title">Recent Payment</span>
            <span class="stat-value" style="font-size:1.5rem; display: flex; justify-content: space-between; align-items: center;">
                ${lastPayment ? '$' + lastPayment.amount : 'No Payments'} 
                ${payStatusHtml}
            </span>
        </div>
    `;
}

function renderTenantPayments(payments) {
    const tbody = document.getElementById('tenantPaymentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const userEmail = (localStorage.getItem('email') || '').toLowerCase();
    const filtered = payments.filter(p => {
        const tenantLower = (p.tenant || '').toLowerCase();
        return tenantLower === userEmail || tenantLower.includes('tenant');
    });
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">No payments yet</td></tr>';
        return;
    }
    filtered.forEach(payment => {
        const statusClass = payment.status === 'Resolved' ? 'status-paid' : (payment.status === 'Completed' ? 'status-paid' : (payment.status === 'Processing' ? 'status-pending' : 'status-overdue'));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>$${payment.amount}</td>
            <td>${payment.date}</td>
            <td>
                <select onchange="updatePaymentStatusDirect('${payment._id}', this.value)" style="padding:0.25rem 0.5rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                    <option value="${payment.status || 'Pending'}">${payment.status || 'Pending'}</option>
                    <option value="Pending">Pending</option>
                    <option value="Resolved">Resolved</option>
                </select>
            </td>
            <td>
                <button class="btn btn-danger" style="padding:0.25rem 0.5rem; font-size:0.75rem;" onclick="deletePayment('${payment._id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTenantMaintenance(maintenance) {
    const tbody = document.getElementById('tenantMaintenanceTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    const userEmail = (localStorage.getItem('email') || '').toLowerCase();
    const userName = (localStorage.getItem('name') || '').toLowerCase();
    const filtered = maintenance.filter(m => {
        const tenantEmailLower = (m.tenantEmail || '').toLowerCase();
        const tenantNameLower = (m.tenantName || '').toLowerCase();
        return tenantEmailLower === userEmail || tenantNameLower === userName;
    });
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No maintenance requests</td></tr>';
        return;
    }
    filtered.forEach(maint => {
        const statusClass = maint.status === 'Completed' ? 'status-paid' : (maint.status === 'Processing' ? 'status-pending' : 'status-overdue');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${maint.issue}</strong></td>
            <td><small style="color:#94a3b8">${maint.description || 'N/A'}</small></td>
            <td><span class="status-badge ${statusClass}">${maint.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats(properties, payments, bookings, maintenance) {
    // Total Properties (landlord specific)
    const totalProperties = properties.length;
    
    // Total Revenue
    const totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;

    // Active Leases (occupied properties)
    const activeLeases = properties.filter(p => !p.available).length;
    document.getElementById('activeLeases').textContent = `${activeLeases} / ${totalProperties}`;

    // Maintenance Requests
    const pendingMaint = maintenance ? maintenance.filter(m => m.status !== 'Completed').length : 0;
    document.getElementById('maintenanceRequests').textContent = pendingMaint.toString();

    // Pending Bookings
    const pendingBookings = bookings ? bookings.filter(b => b.status === 'Pending').length : 0;
    const pbElement = document.getElementById('pendingBookings');
    if(pbElement) pbElement.textContent = pendingBookings.toString();

    // Recent Payments
    renderRecentPayments(payments.slice(-3));

    // Recent Bookings & Maintenance (Overview Landlord View)
    if (localStorage.getItem('role') === 'landlord') {
        renderRecentBookings(bookings ? bookings.slice(-3) : []);
        renderRecentMaintenance(maintenance ? maintenance.slice(-3) : []);
    }
}

function renderRecentPayments(recentPayments) {
    const tbody = document.getElementById('recentPaymentsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    recentPayments.forEach(pay => {
        const badgeClass = pay.status === 'Completed' ? 'status-paid' : (pay.status === 'Processing' ? 'status-pending' : 'status-overdue');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pay.tenant}</td>
            <td>$${pay.amount}</td>
            <td><span class="status-badge ${badgeClass}">${pay.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRecentBookings(recentBookings) {
    const tbody = document.getElementById('recentBookingsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    recentBookings.forEach(booking => {
        const statusClass = booking.status === 'Approved' ? 'status-paid' : (booking.status === 'Rejected' ? 'status-overdue' : 'status-pending');
        const paymentStatusClass = booking.paymentStatus === 'Resolved' ? 'status-paid' : 'status-pending';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${booking.propertyTitle}</td>
            <td>${booking.tenantName}</td>
            <td><span class="status-badge ${statusClass}">${booking.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderRecentMaintenance(recentMaintenance) {
    const tbody = document.getElementById('recentMaintenanceTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if (recentMaintenance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No maintenance requests</td></tr>';
        return;
    }
    recentMaintenance.forEach(req => {
        const statusClass = req.status === 'Completed' ? 'status-paid' : (req.status === 'Processing' ? 'status-pending' : 'status-overdue');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${req.propertyTitle}</td>
            <td><strong>${req.issue}</strong><br><small style="color:#94a3b8;">${req.description || ''}</small></td>
            <td><span class="status-badge ${statusClass}">${req.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function initChart(ctx) {
    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
        console.error("Chart.js not loaded");
        return;
    }

    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Inter', sans-serif";

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Revenue ($)',
                data: [12000, 19000, 15000, 22000, 18000, 25000],
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    }
                }
            }
        }
    });
}
