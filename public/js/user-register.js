document.addEventListener('DOMContentLoaded', () => {
    const userRegisterForm = document.getElementById('userRegisterForm');

    if (userRegisterForm) {
        userRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('userEmail').value;
            const phoneNumber = document.getElementById('phoneNumber').value;
            const password = document.getElementById('userPassword').value;
            const confirmPassword = document.getElementById('confirmUserPassword').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }

            try {
                const response = await fetch('/api/register/user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ fullName, email, phoneNumber, password })
                });

                const data = await response.json();
                if (response.ok) {
                    alert('User registration successful! Please login.');
                    window.location.href = 'index.html'; // Redirect to login after successful registration
                } else {
                    alert(data.error);
                }
            } catch (error) {
                alert('An error occurred during user registration. Please try again.');
            }
        });
    }
}); 