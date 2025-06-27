document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu (hamburger) functionality
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const authButtons = document.querySelector('.auth-buttons');

    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            if (navLinks) navLinks.classList.toggle('active');
            if (authButtons) authButtons.classList.toggle('active');
        });
    }

    // Code for booking form functionality
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        const urlParams = new URLSearchParams(window.location.search);
        const vehicleId = urlParams.get('vehicleId');
        const vehicleType = urlParams.get('type');
        let vehicleData = null;

        // Populate hidden form fields
        document.getElementById('vehicleId').value = vehicleId;
        document.getElementById('vehicleType').value = vehicleType;

        async function loadVehicleData() {
            try {
                if (vehicleId && vehicleType) {
                    const response = await fetch(`/api/vehicles/${vehicleType}/${vehicleId}`);
                    if (response.ok) {
                        vehicleData = await response.json();
                        document.getElementById('vehicleName').textContent = vehicleData.name || 'Vehicle Name';
                        document.getElementById('vehicleEngine').textContent = vehicleData.engine || 'Standard Engine';
                        document.getElementById('vehicleFuel').textContent = vehicleData.fuel_type || 'Standard';
                        document.getElementById('vehiclePrice').textContent = `₹${vehicleData.price || 0} per day`;
                        updatePriceCalculation();
                    } else {
                        throw new Error('Vehicle not found');
                    }
                } else {
                    throw new Error('Vehicle ID or type not provided');
                }
            } catch (error) {
                console.error('Error loading vehicle data:', error);
                alert('Error loading vehicle information. Please go back and try again.');
                window.location.href = 'index.html';
            }
        }

        function updatePriceCalculation() {
            if (!vehicleData) return;
            const hours = parseInt(document.getElementById('duration').value) || 1;
            const hourlyRate = vehicleData.price || 0;
            const totalAmount = hours * hourlyRate;
            const advancePayment = 100;
            const remainingAmount = totalAmount - advancePayment;

            document.getElementById('totalHours').textContent = hours;
            document.getElementById('totalAmount').textContent = `₹${totalAmount}`;
            document.getElementById('remainingAmount').textContent = `₹${remainingAmount}`;
        }

        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').min = today;
        document.getElementById('duration').addEventListener('input', updatePriceCalculation);

        loadVehicleData();

        bookingForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const formData = {
                vehicleId: document.getElementById('vehicleId').value,
                vehicleType: document.getElementById('vehicleType').value,
                startDate: document.getElementById('startDate').value,
                startTime: document.getElementById('startTime').value,
                duration: document.getElementById('duration').value,
                transactionId: document.getElementById('transactionId').value
            };

            if (!formData.startDate || !formData.startTime || !formData.duration || !formData.transactionId) {
                alert('Missing required fields.');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                alert('You must be logged in to book a vehicle.');
                window.location.href = '/login.html';
                return;
            }

            try {
                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(formData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Booking Aceepted! Please wait and check your Registered email for confirmation and further details.');
                    window.location.href = '/my-bookings.html';
                } else {
                    alert(`Booking failed: ${result.message || 'Unknown error'}`);
                }
            } catch (error) {
                console.error('Error during booking:', error);
                alert('An error occurred while trying to book. Please try again.');
            }
        });
    }
});
