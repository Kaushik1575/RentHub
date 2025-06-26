document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin-login.html';
        return;
    }

    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminToken');
        window.location.href = '/index.html';
    });

    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    function setActiveSection(target) {
        contentSections.forEach(section => section.classList.remove('active'));
        navLinks.forEach(navLink => navLink.parentElement.classList.remove('active'));

        document.getElementById(target).classList.add('active');
        document.querySelector(`.nav-link[data-target="${target}"]`).parentElement.classList.add('active');

        // Load content for the active section
        if (target === 'dashboard') {
            loadDashboardStats();
        } else if (target === 'bookings') {
            loadBookings();
        } else if (target === 'users') {
            loadUsers();
        } else if (target === 'vehicles') {
            loadVehicles();
        } else if (target === 'policies') {
            loadPolicies();
        }
        // Add other content loaders here, e.g., loadVehicles()
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            setActiveSection(target);
        });
    });

    async function loadDashboardStats() {
        try {
            const response = await fetch('/api/dashboard-stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch stats');
            const stats = await response.json();
            
            document.getElementById('total-vehicles').textContent = stats.totalVehicles;
            document.getElementById('total-bookings-month').textContent = stats.totalBookingsMonth;
            document.getElementById('active-users').textContent = stats.activeUsers;
            document.getElementById('pending-bookings').textContent = stats.pendingBookings;
            document.getElementById('confirmed-bookings').textContent = stats.confirmedBookings;
            document.getElementById('cancelled-bookings').textContent = stats.cancelledBookings;
            document.getElementById('pending-refunds').textContent = stats.pendingRefunds;
            document.getElementById('todays-bookings').textContent = stats.todaysBookings;

            // Render recent activity
            const activityLog = document.getElementById('activity-log');
            if (stats.recentActivity && stats.recentActivity.length > 0) {
                activityLog.innerHTML = stats.recentActivity.map(act => {
                    const date = new Date(act.timestamp);
                    const formatted = date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                    let icon = '<i class="fas fa-plus-circle" style="color:#007bff"></i>';
                    if (act.type === 'confirmed') icon = '<i class="fas fa-check-circle" style="color:green"></i>';
                    if (act.type === 'cancelled') icon = '<i class="fas fa-times-circle" style="color:red"></i>';
                    return `<div class="activity-item">${icon} <span class="activity-desc">${act.description}</span> <span class="activity-time">${formatted}</span></div>`;
                }).join('');
            } else {
                activityLog.innerHTML = '<p>No recent activity.</p>';
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    let allBookings = [];

    async function loadBookings() {
        const tableBody = document.getElementById('bookings-table-body');
        tableBody.innerHTML = '<tr><td colspan="11">Loading bookings...</td></tr>';

        try {
            const response = await fetch('/api/admin/bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch bookings');
            allBookings = await response.json();
            renderBookingsTable();
        } catch (error) {
            console.error('Error loading bookings:', error);
            tableBody.innerHTML = '<tr><td colspan="11" style="color: red;">Error loading bookings.</td></tr>';
        }
    }

    function renderBookingsTable() {
        const tableBody = document.getElementById('bookings-table-body');
        const searchTerm = document.getElementById('booking-search').value.toLowerCase();
        const statusFilter = document.getElementById('booking-status-filter').value.toLowerCase();
        const dateFilter = document.getElementById('booking-date').value;

        // Filter bookings
        const filtered = allBookings.filter(booking => {
            const matchesSearch = (
                (booking.customerName || '').toLowerCase().includes(searchTerm) ||
                (booking.vehicleName || '').toLowerCase().includes(searchTerm) ||
                (booking.id || '').toString().includes(searchTerm)
            );
            const matchesStatus = !statusFilter || (booking.status || '').toLowerCase() === statusFilter;
            const matchesDate = !dateFilter || booking.start_date === dateFilter;
            return matchesSearch && matchesStatus && matchesDate;
        });

        tableBody.innerHTML = '';
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="11">No bookings found</td></tr>';
            return;
        }

        filtered.forEach(booking => {
            const row = document.createElement('tr');
            const startDate = booking.start_date !== 'N/A' ? 
                new Date(booking.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 
                'N/A';
            const statusBadge = `<span class="status-badge status-${(booking.status || 'pending').toLowerCase()}">${booking.status || 'Pending'}</span>`;

            // --- Action Buttons ---
            let actionButtonsHtml = '';
            const status = (booking.status || 'pending').toLowerCase();

            // Refund mark as completed button logic
            let refundCompleteBtn = '';
            if ((status === 'cancelled' || status === 'rejected') && booking.refund_status === 'processing') {
                refundCompleteBtn = `<button class="action-btn btn-confirm-refund" data-id="${booking.id}"><i class="fas fa-check"></i> Mark as Completed</button>`;
            }

            if (status === 'pending') {
                actionButtonsHtml = `
                    <div class="action-buttons-container">
                        <button class="action-btn btn-view" data-id="${booking.id}"><i class="fas fa-eye"></i> View</button>
                        <button class="action-btn confirm-btn" data-id="${booking.id}">Confirm</button>
                        <button class="action-btn btn-reject" data-id="${booking.id}"><i class="fas fa-times"></i> Reject</button>
                    </div>
                `;
            } else if (status === 'confirmed' || status === 'cancelled' || status === 'rejected') {
                actionButtonsHtml = `
                    <div class="action-buttons-container">
                        <button class="action-btn btn-view" data-id="${booking.id}"><i class="fas fa-eye"></i> View</button>
                        <button class="action-btn btn-edit" data-id="${booking.id}"><i class="fas fa-edit"></i> Edit</button>
                        <button class="action-btn btn-delete" data-id="${booking.id}"><i class="fas fa-trash"></i> Delete</button>
                        ${refundCompleteBtn}
                    </div>
                `;
            } else {
                actionButtonsHtml = '<span>No actions available</span>';
            }

            // --- Refund Info ---
            let refundInfoHtml = 'N/A';
            if (status === 'cancelled' || status === 'rejected') {
                const refundStatus = booking.refund_status || 'pending';
                const refundAmount = (booking.refund_amount || 0).toFixed(2);
                const deductionAmount = (booking.refund_deduction || 0).toFixed(2);

                refundInfoHtml = `
                    <div class="refund-info">
                        <p><strong>Refund Amount:</strong> ₹${refundAmount}</p>
                        <p><strong>Deduction:</strong> ₹${deductionAmount}</p>
                        <p><strong>Status:</strong> <span class="status-${refundStatus}">${refundStatus.toUpperCase()}</span></p>`;

                if (booking.refund_details) {
                    refundInfoHtml += `<div class="payment-details">`;
                    if (booking.refund_details.method === 'upi') {
                        refundInfoHtml += `
                            <p><b>Payment Method:</b> UPI</p>
                            <p><b>UPI ID:</b> ${booking.refund_details.upiId || 'N/A'}</p>
                            <p><b>Phone:</b> ${booking.refund_details.phone || 'N/A'}</p>`;
                    } else if (booking.refund_details.method === 'bank') {
                        refundInfoHtml += `
                            <p><b>Payment Method:</b> Bank Transfer</p>
                            <p><b>Account Holder:</b> ${booking.refund_details.accountHolder || 'N/A'}</p>
                            <p><b>Account Number:</b> ${booking.refund_details.accountNumber || 'N/A'}</p>
                            <p><b>IFSC Code:</b> ${booking.refund_details.ifsc || 'N/A'}</p>`;
                    }
                    refundInfoHtml += `</div>`;
                }
                refundInfoHtml += `</div>`;
            }

            row.innerHTML = `
                <td>${booking.id || 'N/A'}</td>
                <td>${booking.customerName || 'N/A'}</td>
                <td>${booking.vehicleName || 'N/A'}</td>
                <td>${startDate}</td>
                <td>${booking.duration || 0} hrs</td>
                <td>₹${(booking.total_amount || 0).toFixed(2)}</td>
                <td>₹${(booking.advance_payment || 0).toFixed(2)}</td>
                <td>₹${(booking.remaining_amount || 0).toFixed(2)}</td>
                <td>${statusBadge}</td>
                <td>${refundInfoHtml}</td>
                <td>${actionButtonsHtml}</td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for refund completion buttons
        document.querySelectorAll('.btn-confirm-refund').forEach(button => {
            button.addEventListener('click', async (e) => {
                const bookingId = e.target.closest('button').dataset.id;
                if (confirm('Are you sure you want to mark this refund as completed?')) {
                    try {
                        const response = await fetch(`/api/admin/bookings/${bookingId}/refund-complete`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        if (!response.ok) {
                            throw new Error('Failed to update refund status');
                        }

                        showMessage('success', 'Refund marked as completed successfully');
                        loadBookings(); // Refresh the bookings table
                        loadDashboardStats(); // Refresh dashboard stats to update pending refund count
                    } catch (error) {
                        showMessage('error', 'Failed to update refund status: ' + error.message);
                    }
                }
            });
        });
        // Add event listeners for reject buttons
        document.querySelectorAll('.btn-reject').forEach(button => {
            button.addEventListener('click', function() {
                const bookingId = this.getAttribute('data-id');
                if (bookingId) handleRejectBooking(bookingId);
            });
        });
        // Add event listeners for delete buttons
        attachDeleteListeners();
        attachActionListeners();
    }

    // Attach filter event listeners
    document.getElementById('booking-search').addEventListener('input', renderBookingsTable);
    document.getElementById('booking-status-filter').addEventListener('change', renderBookingsTable);
    document.getElementById('booking-date').addEventListener('change', renderBookingsTable);

    let allUsers = [];

    async function loadUsers() {
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '<tr><td colspan="6">Loading users...</td></tr>';
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch users');
            allUsers = await response.json();
            renderUsersTable();
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" style="color:red;">Error loading users.</td></tr>`;
        }
    }

    function renderUsersTable() {
        const tableBody = document.getElementById('users-table-body');
        tableBody.innerHTML = '';
        let filtered = allUsers;
        const search = document.getElementById('user-search').value.trim().toLowerCase();
        if (search) {
            filtered = filtered.filter(u =>
                (u.fullName && u.fullName.toLowerCase().includes(search)) ||
                (u.adminName && u.adminName.toLowerCase().includes(search)) ||
                (u.email && u.email.toLowerCase().includes(search)) ||
                (u.phoneNumber && u.phoneNumber.toLowerCase().includes(search))
            );
        }
        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
            return;
        }
        filtered.forEach(user => {
            const row = document.createElement('tr');
            const isBlocked = user.isBlocked ? true : false;
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.fullName || user.adminName || ''}</td>
                <td>${user.email}</td>
                <td>${user.phoneNumber || ''}</td>
                <td>${user.isAdmin ? 'Admin' : 'User'}</td>
                <td>${isBlocked ? '<span style="color:red;">Blocked</span>' : '<span style="color:green;">Active</span>'}</td>
                <td>
                    <button class="action-btn btn-view-user" data-id="${user.id}"><i class="fas fa-eye"></i> View</button>
                    <button class="action-btn btn-edit-user" data-id="${user.id}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="action-btn ${isBlocked ? 'btn-unblock-user' : 'btn-block-user'}" data-id="${user.id}">
                        <i class="fas fa-ban"></i> ${isBlocked ? 'Unblock' : 'Block'}
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    document.getElementById('user-search').addEventListener('input', renderUsersTable);

    // --- Vehicle Management ---
    let allVehicles = [];

    async function loadVehicles() {
        const tableBody = document.getElementById('vehicles-table-body');
        tableBody.innerHTML = '<tr><td colspan="7">Loading vehicles...</td></tr>';
        try {
            // Fetch all vehicles from a single endpoint
            const allVehiclesResp = await fetch('/api/admin/vehicles', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!allVehiclesResp.ok) throw new Error('Failed to fetch vehicles');
            allVehicles = await allVehiclesResp.json();
            renderVehiclesTable();
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="7" style="color:red;">Error loading vehicles.</td></tr>';
        }
    }

    function renderVehiclesTable() {
        const tableBody = document.getElementById('vehicles-table-body');
        tableBody.innerHTML = '';
        if (allVehicles.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7">No vehicles found.</td></tr>';
            return;
        }
        allVehicles.forEach(vehicle => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${vehicle.id}</td>
                <td>${vehicle.name}</td>
                <td>${vehicle.type}</td>
                <td>${vehicle.category || ''}</td>
                <td>₹${vehicle.price ? vehicle.price.toFixed(2) : ''}</td>
                <td>${vehicle.status || 'Available'}</td>
                <td>
                    <button class="action-btn btn-view-vehicle" data-id="${vehicle.id}" data-type="${vehicle.type.toLowerCase()}"><i class="fas fa-eye"></i> View</button>
                    <button class="action-btn btn-edit-vehicle" data-id="${vehicle.id}" data-type="${vehicle.type.toLowerCase()}"><i class="fas fa-edit"></i> Edit</button>
                    <button class="action-btn btn-delete-vehicle" data-id="${vehicle.id}" data-type="${vehicle.type.toLowerCase()}"><i class="fas fa-trash"></i> Delete</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    async function openViewVehicleModal(id, type) {
        const content = document.getElementById('vehicle-details-content');
        content.innerHTML = 'Loading...';
        showModal('view-vehicle-modal');
        try {
            const res = await fetch(`/api/admin/vehicles/${type}/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to fetch vehicle');
            const v = await res.json();
            content.innerHTML = `
                <p><strong>Name:</strong> ${v.name}</p>
                <p><strong>Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
                <p><strong>Category:</strong> ${v.category || ''}</p>
                <p><strong>Price:</strong> ₹${v.price ? v.price.toFixed(2) : ''}</p>
                <p><strong>Status:</strong> ${v.status || 'Available'}</p>
            `;
        } catch (err) {
            content.innerHTML = `<span style='color:red;'>Error loading vehicle details.</span>`;
        }
    }

    async function openEditVehicleModal(id, type) {
        showModal('edit-vehicle-modal');
        try {
            const res = await fetch(`/api/admin/vehicles/${type}/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to fetch vehicle');
            const v = await res.json();
            document.getElementById('edit-vehicle-id').value = v.id;
            document.getElementById('edit-vehicle-name').value = v.name;
            document.getElementById('edit-vehicle-type').value = type;
            document.getElementById('edit-vehicle-category').value = v.category || '';
            document.getElementById('edit-vehicle-price').value = v.price || '';
            document.getElementById('edit-vehicle-status').value = v.status || 'available';
        } catch (err) {
            alert('Error loading vehicle details.');
            hideModal('edit-vehicle-modal');
        }
    }

    document.getElementById('edit-vehicle-form').onsubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-vehicle-id').value;
        const type = document.getElementById('edit-vehicle-type').value;
        const data = {
            name: document.getElementById('edit-vehicle-name').value,
            category: document.getElementById('edit-vehicle-category').value,
            price: parseFloat(document.getElementById('edit-vehicle-price').value),
            status: document.getElementById('edit-vehicle-status').value
        };
        try {
            const res = await fetch(`/api/admin/vehicles/${type}/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update vehicle');
            hideModal('edit-vehicle-modal');
            loadVehicles();
        } catch (err) {
            alert('Error updating vehicle.');
        }
    };

    document.getElementById('add-vehicle-btn').onclick = () => {
        document.getElementById('add-vehicle-form').reset();
        showModal('add-vehicle-modal');
    };

    document.getElementById('add-vehicle-form').onsubmit = async function(e) {
        e.preventDefault();
        const type = document.getElementById('add-vehicle-type').value;
        const data = {
            name: document.getElementById('add-vehicle-name').value,
            category: document.getElementById('add-vehicle-category').value,
            price: parseFloat(document.getElementById('add-vehicle-price').value),
            status: document.getElementById('add-vehicle-status').value
        };
        try {
            const res = await fetch(`/api/admin/vehicles/${type}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to add vehicle');
            hideModal('add-vehicle-modal');
            loadVehicles();
        } catch (err) {
            alert('Error adding vehicle.');
        }
    };

    async function handleDeleteVehicle(id, type) {
        if (!confirm('Are you sure you want to delete this vehicle?')) return;
        try {
            const res = await fetch(`/api/admin/vehicles/${type}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to delete vehicle');
            loadVehicles();
        } catch (err) {
            alert('Error deleting vehicle.');
        }
    }

    // Remove duplicate vehicle modal declarations and keep only one modals object
    // The following should appear only once, after all modal elements are defined:
    const viewModal = document.getElementById('view-booking-modal');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const rejectModal = document.getElementById('reject-reason-modal');
    const editModal = document.getElementById('edit-booking-modal');
    const viewUserModal = document.getElementById('view-user-modal');
    const editUserModal = document.getElementById('edit-user-modal');
    const viewVehicleModal = document.getElementById('view-vehicle-modal');
    const editVehicleModal = document.getElementById('edit-vehicle-modal');
    const addVehicleModal = document.getElementById('add-vehicle-modal');
    const modals = {
        'view-booking-modal': viewModal,
        'delete-confirm-modal': deleteModal,
        'reject-reason-modal': rejectModal,
        'edit-booking-modal': editModal,
        'view-user-modal': viewUserModal,
        'edit-user-modal': editUserModal,
        'view-vehicle-modal': viewVehicleModal,
        'edit-vehicle-modal': editVehicleModal,
        'add-vehicle-modal': addVehicleModal
    };

    function showModal(modalId) {
        if (modals[modalId]) {
            modals[modalId].style.display = 'block';
        }
    }

    function hideModal(modalId) {
        if (modals[modalId]) {
            modals[modalId].style.display = 'none';
        }
    }
    
    // Close modal logic
    document.querySelectorAll('.close-button').forEach(btn => {
        btn.onclick = () => hideModal(btn.dataset.modal);
    });
    document.getElementById('cancel-delete-btn').onclick = () => hideModal('delete-confirm-modal');
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            hideModal(event.target.id);
        }
    };

    // Event delegation for users table
    const usersTableBody = document.getElementById('users-table-body');
    usersTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;

        const userId = target.dataset.id;
        if (target.classList.contains('btn-view-user')) {
            const content = document.getElementById('user-details-content');
            content.innerHTML = 'Loading...';
            showModal('view-user-modal');
            try {
                const response = await fetch(`/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch user');
                const user = await response.json();
                content.innerHTML = `
                    <p><strong>Name:</strong> ${user.fullName || ''}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Phone:</strong> ${user.phoneNumber || ''}</p>
                    <p><strong>Status:</strong> <span style="color:${user.isBlocked ? 'red' : 'green'};">${user.isBlocked ? 'Blocked' : 'Active'}</span></p>
                    <p><strong>Role:</strong> ${user.isAdmin ? 'Admin' : 'User'}</p>
                    <p><strong>Created At:</strong> ${user.createdAt ? new Date(user.createdAt).toLocaleString() : ''}</p>
                `;
            } catch (err) {
                content.innerHTML = `<span style='color:red;'>Error loading user details.</span>`;
            }
        } else if (target.classList.contains('btn-edit-user')) {
            showModal('edit-user-modal');
            try {
                const response = await fetch(`/api/admin/users/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch user');
                const user = await response.json();
                document.getElementById('edit-user-id').value = user.id;
                document.getElementById('edit-user-name').value = user.fullName || '';
                document.getElementById('edit-user-email').value = user.email;
                document.getElementById('edit-user-phone').value = user.phoneNumber || '';
            } catch (err) {
                alert('Error loading user details.');
                hideModal('edit-user-modal');
            }
        } else if (target.classList.contains('btn-block-user') || target.classList.contains('btn-unblock-user')) {
            const isUnblock = target.classList.contains('btn-unblock-user');
            if (!confirm(`Are you sure you want to ${isUnblock ? 'unblock' : 'block'} this user?`)) return;
            try {
                const response = await fetch(`/api/admin/users/${userId}/block`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ isBlocked: !isUnblock })
                });
                if (!response.ok) throw new Error('Failed to update user status');
                loadUsers();
            } catch (error) {
                alert('Error updating user status.');
            }
        }
    });

    // Handle user edit form submission
    document.getElementById('edit-user-form').onsubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-user-id').value;
        const data = {
            fullName: document.getElementById('edit-user-name').value,
            email: document.getElementById('edit-user-email').value,
            phoneNumber: document.getElementById('edit-user-phone').value
        };
        try {
            const response = await fetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update user');
            }
            hideModal('edit-user-modal');
            loadUsers();
        } catch (err) {
            alert('Error updating user: ' + err.message);
        }
    };

    // Event delegation for vehicles table
    const vehiclesTableBody = document.getElementById('vehicles-table-body');
    vehiclesTableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;

        const vehicleId = target.dataset.id;
        const vehicleType = target.dataset.type;

        if (target.classList.contains('btn-view-vehicle')) {
            openViewVehicleModal(vehicleId, vehicleType);
        } else if (target.classList.contains('btn-edit-vehicle')) {
            openEditVehicleModal(vehicleId, vehicleType);
        } else if (target.classList.contains('btn-delete-vehicle')) {
            handleDeleteVehicle(vehicleId, vehicleType);
        }
    });

    async function handleViewBooking(bookingId) {
        const detailsContent = document.getElementById('booking-details-content');
        detailsContent.innerHTML = 'Loading...';
        showModal('view-booking-modal');

        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch booking details');
            const booking = await response.json();

            const formatDate = (dateString) => {
                if (!dateString || dateString === 'N/A') return 'N/A';
                return new Date(dateString).toLocaleString('en-IN', { 
                    year: 'numeric', month: 'short', day: 'numeric', 
                    hour: 'numeric', minute: '2-digit', hour12: true 
                });
            };

            let refundHtml = '';
            if (booking.status === 'cancelled' || booking.status === 'rejected') {
                refundHtml = `
                    <div class="detail-section full-width">
                        <h4>Refund Information</h4>
                        <p><strong>Refund Amount:</strong> ₹${(booking.refund_amount || 0).toFixed(2)}</p>
                        <p><strong>Status:</strong> ${booking.refund_status || 'Pending'}</p>
                        <p><strong>Processed On:</strong> ${formatDate(booking.refund_timestamp)}</p>
                    </div>
                `;
            }

            detailsContent.innerHTML = `
                <div class="booking-details">
                    <div class="detail-section">
                        <h4>Booking Information</h4>
                        <p><strong>Booking ID:</strong> ${booking.id || 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="status-badge status-${(booking.status || 'pending').toLowerCase()}">${booking.status || 'Pending'}</span></p>
                        <p><strong>Transaction ID:</strong> ${booking.transaction_id || 'N/A'}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Customer Details</h4>
                        <p><strong>Name:</strong> ${booking.customerName || 'N/A'}</p>
                        <p><strong>Email:</strong> ${booking.customerEmail || 'N/A'}</p>
                        <p><strong>Phone:</strong> ${booking.customerPhone || 'N/A'}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Vehicle Details</h4>
                        <p><strong>Name:</strong> ${booking.vehicleName || 'N/A'}</p>
                        <p><strong>Category:</strong> ${booking.vehicleCategory || 'N/A'}</p>
                    </div>
                    <div class="detail-section">
                        <h4>Financials</h4>
                        <p><strong>Total:</strong> ₹${(booking.total_amount || 0).toFixed(2)}</p>
                        <p><strong>Advance:</strong> ₹${(booking.advance_payment || 0).toFixed(2)}</p>
                        <p><strong>Remaining:</strong> ₹${(booking.remaining_amount || 0).toFixed(2)}</p>
                    </div>
                    <div class="detail-section full-width">
                        <h4>Timestamps</h4>
                        <p><strong>Booking Starts:</strong> ${formatDate(booking.start_date + ' ' + booking.start_time)}</p>
                        <p><strong>Duration:</strong> ${booking.duration || 0} hours</p>
                        <p><strong>Created At:</strong> ${formatDate(booking.created_at)}</p>
                        <p><strong>Confirmed At:</strong> ${formatDate(booking.confirmation_timestamp)}</p>
                        <p><strong>Cancelled At:</strong> ${formatDate(booking.cancelled_timestamp)}</p>
                    </div>
                    ${refundHtml}
                </div>
            `;
        } catch (error) {
            detailsContent.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function openEditBookingModal(bookingId) {
        // Fetch booking details and prefill modal
        fetch(`/api/admin/bookings/${bookingId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(booking => {
            document.getElementById('edit-booking-id').value = booking.id;
            document.getElementById('edit-start-date').value = booking.start_date ? booking.start_date.split('T')[0] : '';
            document.getElementById('edit-start-time').value = booking.start_time || '';
            document.getElementById('edit-duration').value = booking.duration || '';
            document.getElementById('edit-status').value = booking.status || 'pending';
            document.getElementById('edit-total-amount').value = booking.total_amount || '';
            document.getElementById('edit-advance-payment').value = booking.advance_payment || '';
            document.getElementById('edit-remaining-amount').value = booking.remaining_amount || '';
            showModal('edit-booking-modal');
        });
    }

    document.getElementById('edit-booking-form').onsubmit = async function(e) {
        e.preventDefault();
        const id = document.getElementById('edit-booking-id').value;
        const data = {
            start_date: document.getElementById('edit-start-date').value,
            start_time: document.getElementById('edit-start-time').value,
            duration: parseInt(document.getElementById('edit-duration').value),
            status: document.getElementById('edit-status').value,
            total_amount: parseFloat(document.getElementById('edit-total-amount').value),
            advance_payment: parseFloat(document.getElementById('edit-advance-payment').value),
            remaining_amount: parseFloat(document.getElementById('edit-remaining-amount').value)
        };
        try {
            const response = await fetch(`/api/admin/bookings/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to update booking');
            hideModal('edit-booking-modal');
            loadBookings();
        } catch (err) {
            alert('Error updating booking.');
        }
    };

    let bookingIdToDelete = null;

    function attachDeleteListeners() {
        document.querySelectorAll('.btn-delete').forEach(button => {
            button.addEventListener('click', function() {
                bookingIdToDelete = this.getAttribute('data-id');
                showModal('delete-confirm-modal');
            });
        });
    }

    async function handleConfirmBooking(bookingId) {
        try {
            console.log('Confirming booking:', bookingId);
            const response = await fetch(`/api/admin/bookings/${bookingId}/confirm`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();
            console.log('Confirm booking response:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Failed to confirm booking');
            }

            // Show success message
            showMessage('success', 'Booking confirmed successfully!');

            // Update the booking in the UI
            const bookingElement = document.querySelector(`[data-booking-id="${bookingId}"]`);
            if (bookingElement) {
                bookingElement.querySelector('.booking-status').textContent = 'Confirmed';
                bookingElement.querySelector('.confirm-btn').style.display = 'none';
                bookingElement.querySelector('.reject-btn').style.display = 'none';
            }

            // Refresh the bookings list
            await fetchAndDisplayBookings();
        } catch (error) {
            console.error('Error confirming booking:', error);
            showMessage('error', `Failed to confirm booking: ${error.message}`);
        }
    }

    function showMessage(type, message) {
        const messageDiv = document.getElementById('message-container') || createMessageContainer();
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    function createMessageContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.id = 'message-container';
        messageDiv.style.position = 'fixed';
        messageDiv.style.top = '20px';
        messageDiv.style.right = '20px';
        messageDiv.style.padding = '10px 20px';
        messageDiv.style.borderRadius = '5px';
        messageDiv.style.zIndex = '1000';
        document.body.appendChild(messageDiv);
        return messageDiv;
    }

    // Add CSS for message types
    const style = document.createElement('style');
    style.textContent = `
        .message {
            padding: 10px 20px;
            border-radius: 5px;
            margin-bottom: 10px;
            animation: fadeIn 0.3s ease-in;
        }
        .message.success {
            background-color: #4CAF50;
            color: white;
        }
        .message.error {
            background-color: #f44336;
            color: white;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);

    function handleRejectBooking(bookingId) {
        showModal('reject-reason-modal');
        document.getElementById('rejection-reason-text').value = ''; // Clear previous reason
        
        document.getElementById('submit-rejection-btn').onclick = async () => {
            const reason = document.getElementById('rejection-reason-text').value.trim();
            if (!reason) {
                alert('Please provide a reason for rejection.');
                return;
            }

            try {
                const response = await fetch(`/api/admin/bookings/${bookingId}/reject`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to reject booking');
                }

                hideModal('reject-reason-modal');
                document.getElementById('rejection-reason-text').value = '';
                await loadBookings(); // Refresh the bookings list
                alert('Booking rejected successfully!');
            } catch (error) {
                console.error('Error rejecting booking:', error);
                alert(error.message || 'Error rejecting booking.');
            }
        };
    }

    // Show admin name in sidebar
    async function showAdminName() {
        // ...existing code...
    }
    showAdminName();

    // Initial load
    setActiveSection('dashboard');

    async function loadPolicies() {
        const tableBody = document.getElementById('policies-table-body');
        tableBody.innerHTML = '<tr><td colspan="3">Loading policies...</td></tr>';
        try {
            const response = await fetch('/api/admin/policies', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error('Failed to fetch policies');
            const policies = await response.json();
            tableBody.innerHTML = '';
            if (!policies.length) {
                tableBody.innerHTML = '<tr><td colspan="3">No policies found.</td></tr>';
                return;
            }
            policies.forEach((policy, idx) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${idx + 1}</td>
                    <td>${policy.title || ''}</td>
                    <td>${policy.description || ''}</td>
                `;
                tableBody.appendChild(row);
            });
        } catch (error) {
            tableBody.innerHTML = '<tr><td colspan="3" style="color:red;">Error loading policies.</td></tr>';
        }
    }

    // Update setActiveSection to load policies
    const originalSetActiveSection = setActiveSection;
    setActiveSection = function(target) {
        originalSetActiveSection(target);
        if (target === 'vehicles') {
            loadVehicles();
        } else if (target === 'policies') {
            loadPolicies();
        }
    };

    function createBookingCard(booking) {
        const card = document.createElement('div');
        card.className = 'booking-card';
        card.id = `booking-${booking.id}`;

        // Format the date and time
        const startDate = new Date(booking.start_date);
        const formattedDate = startDate.toLocaleDateString();
        const formattedTime = booking.start_time;

        // Get user details
        const user = booking.users || {};
        const userName = user.full_name || 'N/A';
        const userEmail = user.email || 'N/A';
        const userPhone = user.phone_number || 'N/A';

        // Get vehicle details
        const vehicle = booking.vehicle || {};
        const vehicleName = vehicle.name || 'N/A';
        const vehiclePrice = vehicle.price || 'N/A';

        card.innerHTML = `
            <div class="booking-header">
                <h3>Booking #${booking.id}</h3>
                <span class="status ${booking.status}">${booking.status}</span>
            </div>
            <div class="booking-details">
                <p><strong>Customer:</strong> ${userName}</p>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Phone:</strong> ${userPhone}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${formattedTime}</p>
                <p><strong>Duration:</strong> ${booking.duration} hours</p>
                <p><strong>Vehicle Type:</strong> ${booking.vehicle_type}</p>
                <p><strong>Vehicle:</strong> ${vehicleName}</p>
                <p><strong>Price:</strong> ₹${vehiclePrice}/hr</p>
                <p><strong>Transaction ID:</strong> ${booking.transaction_id}</p>
            </div>
            <div class="booking-actions">
                ${booking.status === 'pending' ? `
                    <button class="action-btn confirm-btn" data-id="${booking.id}">Confirm</button>
                    <button class="action-btn reject-btn" data-id="${booking.id}">Reject</button>
                ` : ''}
                ${booking.status === 'confirmed' ? `
                    <button class="cancel-btn" onclick="cancelBooking(${booking.id})">Cancel</button>
                ` : ''}
            </div>
        `;

        return card;
    }

    // Function to fetch and display bookings
    async function fetchAndDisplayBookings() {
        try {
            const response = await fetch('/api/admin/bookings', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const bookings = await response.json();
            const bookingsContainer = document.getElementById('bookings-container');
            bookingsContainer.innerHTML = ''; // Clear existing bookings

            bookings.forEach(booking => {
                const card = createBookingCard(booking);
                bookingsContainer.appendChild(card);
            });

            attachDeleteListeners();
            attachActionListeners();
        } catch (error) {
            console.error('Error fetching bookings:', error);
            showMessage('error', error.message);
        }
    }

    // Function to confirm booking
    async function confirmBooking(bookingId) {
        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            const data = await response.json();
            if (!response.ok) {
                console.error('Confirm booking error response:', data);
                throw new Error(data.error || data.message || 'Failed to confirm booking');
            }
            // Update the booking card
            const bookingCard = document.getElementById(`booking-${bookingId}`);
            if (bookingCard) {
                const updatedBooking = data.booking;
                const newCard = createBookingCard(updatedBooking);
                bookingCard.replaceWith(newCard);
            }

            showMessage('success', 'Booking confirmed successfully');
        } catch (error) {
            console.error('Error confirming booking:', error);
            showMessage('error', error.message);
        }
    }

    // Function to reject booking
    async function rejectBooking(bookingId) {
        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            const data = await response.json();
            if (!response.ok) {
                console.error('Reject booking error response:', data);
                throw new Error(data.error || data.message || 'Failed to reject booking');
            }
            // Update the booking card
            const bookingCard = document.getElementById(`booking-${bookingId}`);
            if (bookingCard) {
                const updatedBooking = data.booking;
                const newCard = createBookingCard(updatedBooking);
                bookingCard.replaceWith(newCard);
            }

            showMessage('success', 'Booking rejected successfully');
        } catch (error) {
            console.error('Error rejecting booking:', error);
            showMessage('error', error.message);
        }
    }

    // Function to cancel booking
    async function cancelBooking(bookingId) {
        try {
            const response = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to cancel booking');
            }

            // Update the booking card
            const bookingCard = document.getElementById(`booking-${bookingId}`);
            if (bookingCard && data.booking) {
                const newCard = createBookingCard(data.booking);
                bookingCard.replaceWith(newCard);
            }

            showMessage('success', 'Booking canceled successfully');
        } catch (error) {
            console.error('Error canceling booking:', error);
            showMessage('error', error.message);
        }
    }

    // Call fetchAndDisplayBookings when the page loads
    document.addEventListener('DOMContentLoaded', () => {
        fetchAndDisplayBookings();
        // Refresh bookings every 30 seconds
        setInterval(fetchAndDisplayBookings, 30000);
    });

    const confirmBtn = document.getElementById('confirm-delete-btn');
    if (confirmBtn) {
        confirmBtn.onclick = async function() {
            console.log('Confirm delete clicked. Booking ID:', bookingIdToDelete);
            if (!bookingIdToDelete) return;
            try {
                const response = await fetch(`/api/admin/bookings/${bookingIdToDelete}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to delete booking');
                hideModal('delete-confirm-modal');
                loadBookings();
            } catch (err) {
                alert('Error deleting booking.');
            }
        };
    }

    function attachActionListeners() {
        document.querySelectorAll('.confirm-btn').forEach(btn => {
            btn.onclick = function() {
                const bookingId = this.getAttribute('data-id');
                if (bookingId) confirmBooking(bookingId);
            };
        });
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.onclick = function() {
                const bookingId = this.getAttribute('data-id');
                console.log('Reject button clicked. Booking ID:', bookingId);
                if (bookingId) rejectBooking(bookingId);
            };
        });
        document.querySelectorAll('.btn-view').forEach(btn => {
            btn.onclick = function() {
                const bookingId = this.getAttribute('data-id');
                if (bookingId) handleViewBooking(bookingId);
            };
        });
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = function() {
                const bookingId = this.getAttribute('data-id');
                if (bookingId) openEditBookingModal(bookingId);
            };
        });
    }

    // After defining confirmBooking, rejectBooking, handleViewBooking:
    window.confirmBooking = confirmBooking;
    window.rejectBooking = rejectBooking;
    window.handleViewBooking = handleViewBooking;
});