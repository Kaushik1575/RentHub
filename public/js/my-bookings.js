// Redirect to login if not logged in
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', async () => {
    const bookingsList = document.getElementById('bookingsList');
    const noBookingsMessage = document.querySelector('.no-bookings');
    const cancellationModal = document.getElementById('cancellationModal');
    let currentBookingId = null;

    // Close modal when clicking outside or on close button
    cancellationModal.addEventListener('click', (e) => {
        if (e.target === cancellationModal) {
            closeCancellationModal();
        }
    });

    document.querySelector('.close-modal').addEventListener('click', closeCancellationModal);
    document.querySelector('.btn-keep-booking').addEventListener('click', closeCancellationModal);

    // Add event listener for refund method radio buttons
    const refundUpi = document.getElementById('refundUpi');
    const refundBank = document.getElementById('refundBank');
    const upiDetails = document.getElementById('upiDetails');
    const bankDetails = document.getElementById('bankDetails');

    if (refundUpi && refundBank) {
        refundUpi.addEventListener('change', () => {
            if (refundUpi.checked) {
                upiDetails.style.display = 'block';
                bankDetails.style.display = 'none';
            }
        });
        refundBank.addEventListener('change', () => {
            if (refundBank.checked) {
                upiDetails.style.display = 'none';
                bankDetails.style.display = 'block';
            }
        });
    }

    // Add event listener for confirm cancellation button (outside displayBookings)
    document.querySelector('.btn-confirm-cancel').addEventListener('click', async function() {
        if (!currentBookingId) return;
        
        const cancelBtn = document.querySelector(`.btn-cancel-booking[data-id="${currentBookingId}"]`);
        cancelBtn.disabled = true;
        cancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
        
        // Collect refund details from form
        const refundMethod = document.querySelector('input[name="refundMethod"]:checked').value;
        let refundDetails = { method: refundMethod };
        if (refundMethod === 'upi') {
            refundDetails.upiId = document.getElementById('upiId').value.trim();
        } else if (refundMethod === 'bank') {
            refundDetails.accountHolder = document.getElementById('accountHolder').value.trim();
            refundDetails.accountNumber = document.getElementById('accountNumber').value.trim();
            refundDetails.ifsc = document.getElementById('ifsc').value.trim();
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('You must be logged in to cancel a booking');
            }

            const response = await fetch(`/api/bookings/${currentBookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refundDetails })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to cancel booking');
            }

            const data = await response.json();
            alert(`Booking cancelled successfully!\nRefund Amount: ₹${data.refundAmount}${data.deduction ? '\nDeduction: ₹' + data.deduction : ''}\nRefund will be processed within 1-2 hours to the account you provided.`);
            closeCancellationModal();
            fetchUserBookings();
        } catch (error) {
            alert(error.message || 'Error cancelling booking. Please try again.');
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel';
            closeCancellationModal();
        }
    });

    function closeCancellationModal() {
        cancellationModal.style.display = 'none';
        currentBookingId = null;
    }

    async function fetchUserBookings() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = 'login.html';
                return;
            }

            const response = await fetch('/api/bookings/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch bookings');
            }

            const bookings = await response.json();
            displayBookings(bookings);
        } catch (error) {
            console.error('Error fetching bookings:', error);
            bookingsList.innerHTML = '<p class="error">Error loading bookings. Please try again.</p>';
        }
    }

    async function displayBookings(bookings) {
        if (bookings.length === 0) {
            noBookingsMessage.style.display = 'block';
            return;
        }

        noBookingsMessage.style.display = 'none';
        // Fetch vehicle details for each booking
        const bookingCards = await Promise.all(bookings.map(async booking => {
            let vehicleName = 'N/A';
            let vehicleType = booking.vehicle_type || 'N/A';
            let vehiclePrice = 0;
            if (booking.vehicle_id && vehicleType) {
                try {
                    // Map plural table name
                    let typeTable = vehicleType;
                    if (vehicleType === 'car') typeTable = 'cars';
                    if (vehicleType === 'bike') typeTable = 'bikes';
                    if (vehicleType === 'scooty') typeTable = 'scooty';
                    const res = await fetch(`/api/vehicles/${typeTable}/${booking.vehicle_id}`);
                    if (res.ok) {
                        const vehicle = await res.json();
                        vehicleName = vehicle.name || 'N/A';
                        vehiclePrice = vehicle.price || 0;
                    }
                } catch (e) { /* ignore */ }
            }
            const duration = parseInt(booking.duration) || 0;
            const totalAmount = duration * vehiclePrice;
            const advancePayment = 100;
            const remainingAmount = totalAmount - advancePayment;
            // Add refund details button for rejected bookings without refund details
            let refundDetailsBtn = '';
            if (booking.status === 'rejected' && !booking.refund_details) {
                refundDetailsBtn = `<button class="btn-submit-refund-details-card" data-id="${booking.id}" style="width: auto;">Submit Refund Details</button>`;
            }
            return `
                <div class="booking-card">
                    <h3>Booking ID: ${booking.id}</h3>
                    <p><strong>Vehicle:</strong> ${vehicleName} (${vehicleType})</p>
                    <p><strong>Start Date:</strong> ${booking.start_date || 'N/A'}</p>
                    <p><strong>End Date:</strong> ${booking.end_date || 'N/A'}</p>
                    <p><strong>Duration:</strong> ${duration || 'N/A'} hours</p>
                    <p><strong>Total Amount:</strong> ₹${totalAmount || 'N/A'}</p>
                    <p><strong>Advance Payment:</strong> ₹${advancePayment || 'N/A'}</p>
                    <p><strong>Remaining Amount:</strong> ₹${remainingAmount >= 0 ? remainingAmount : 'N/A'}</p>
                    <p><strong>Transaction ID:</strong> ${booking.transaction_id || 'N/A'}</p>
                    <span class="booking-status status-${booking.status}">${booking.status ? booking.status.toUpperCase() : 'N/A'}</span>
                    ${booking.status === 'confirmed' ? `
                        <button class="btn-cancel-booking" data-id="${booking.id}">
                            <i class="fas fa-times"></i> Cancel Booking
                        </button>
                    ` : ''}
                    ${(booking.status === 'cancelled' && booking.refund_amount) ? `
                        <div class="refund-info">
                            <p><strong>Refund Amount:</strong> ₹${booking.refund_amount}</p>
                            <p><strong>Refund Status:</strong> ${booking.refund_status || 'Processing'}</p>
                            ${booking.refund_details ? `
                                <p><strong>Refund To:</strong> ${booking.refund_details.method === 'upi' ? 
                                    `UPI: ${booking.refund_details.upiId}` : 
                                    `Bank Account: ${booking.refund_details.accountHolder} (${booking.refund_details.accountNumber})`
                                }</p>
                            ` : ''}
                        </div>
                    ` : ''}
                    ${(booking.status === 'rejected' && booking.refund_details) ? `
                        <div class="refund-info">
                            <p><strong>Refund Status:</strong> Pending</p>
                            <p><strong>Refund To:</strong> ${booking.refund_details.method === 'upi' ? 
                                `UPI: ${booking.refund_details.upiId}` : 
                                `Bank Account: ${booking.refund_details.accountHolder} (${booking.refund_details.accountNumber})`
                            }</p>
                        </div>
                    ` : ''}
                    ${refundDetailsBtn}
                </div>
            `;
        }));
        bookingsList.innerHTML = bookingCards.join('');
        // Add event listeners for cancel buttons (if needed)
        document.querySelectorAll('.btn-cancel-booking').forEach(btn => {
            btn.addEventListener('click', function() {
                currentBookingId = this.getAttribute('data-id');
                cancellationModal.style.display = 'block';
            });
        });
        // Add event listeners for refund details buttons (rejected)
        document.querySelectorAll('.btn-submit-refund-details-card').forEach(btn => {
            btn.addEventListener('click', function() {
                currentBookingId = this.getAttribute('data-id');
                document.getElementById('refundDetailsModal').style.display = 'block';
            });
        });
    }

    // Function to cancel a booking
    async function cancelBooking(bookingId) {
        try {
            if (!confirm('Are you sure you want to cancel this booking?')) {
                return;
            }

            const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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

            // Show success message
            alert('Booking cancelled successfully');
        } catch (error) {
            console.error('Error cancelling booking:', error);
            alert(error.message);
        }
    }

    // Refund details modal logic for rejected bookings
    const refundDetailsModal = document.getElementById('refundDetailsModal');
    const closeRefundModalBtn = document.querySelector('.close-modal-refund');
    if (closeRefundModalBtn) {
        closeRefundModalBtn.onclick = () => refundDetailsModal.style.display = 'none';
    }
    window.onclick = (event) => {
        if (event.target === refundDetailsModal) {
            refundDetailsModal.style.display = 'none';
        }
    };
    // Show/hide UPI/Bank fields in refund modal
    const refundUpiRejected = document.getElementById('refundUpiRejected');
    const refundBankRejected = document.getElementById('refundBankRejected');
    const upiDetailsRejected = document.getElementById('upiDetailsRejected');
    const bankDetailsRejected = document.getElementById('bankDetailsRejected');
    if (refundUpiRejected && refundBankRejected) {
        refundUpiRejected.addEventListener('change', () => {
            if (refundUpiRejected.checked) {
                upiDetailsRejected.style.display = 'block';
                bankDetailsRejected.style.display = 'none';
            }
        });
        refundBankRejected.addEventListener('change', () => {
            if (refundBankRejected.checked) {
                upiDetailsRejected.style.display = 'none';
                bankDetailsRejected.style.display = 'block';
            }
        });
    }
    document.querySelector('.btn-submit-refund-details').addEventListener('click', async function() {
        if (!currentBookingId) return;
        const method = document.querySelector('input[name="refundMethodRejected"]:checked').value;
        let refundDetails = { method };
        if (method === 'upi') {
            refundDetails.upiId = document.getElementById('upiIdRejected').value.trim();
            if (!refundDetails.upiId) {
                alert('Please enter your UPI ID or phone number.');
                return;
            }
        } else if (method === 'bank') {
            refundDetails.accountHolder = document.getElementById('accountHolderRejected').value.trim();
            refundDetails.accountNumber = document.getElementById('accountNumberRejected').value.trim();
            refundDetails.ifsc = document.getElementById('ifscRejected').value.trim();
            if (!refundDetails.accountHolder || !refundDetails.accountNumber || !refundDetails.ifsc) {
                alert('Please fill in all bank details.');
                return;
            }
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/bookings/${currentBookingId}/refund-details`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refundDetails })
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to submit refund details');
            }
            alert('Refund details submitted successfully!');
            refundDetailsModal.style.display = 'none';
            fetchUserBookings();
        } catch (error) {
            alert(error.message || 'Error submitting refund details. Please try again.');
        }
    });

    // After booking is confirmed (example placement)
    function showBookingConfirmedMessage() {
        const messageContainer = document.getElementById('bookingMessage') || document.createElement('div');
        messageContainer.id = 'bookingMessage';
        messageContainer.innerHTML = 'Booking confirmed! Please check your email for details.<br><small>If you do not see the email, please check your spam or junk folder and mark it as "Not Spam".</small>';
        messageContainer.style.color = '#155724';
        messageContainer.style.background = '#d4edda';
        messageContainer.style.padding = '1em';
        messageContainer.style.borderRadius = '5px';
        messageContainer.style.margin = '1em 0';
        const parent = document.body;
        if (!document.getElementById('bookingMessage')) parent.prepend(messageContainer);
    }

    fetchUserBookings();
}); 