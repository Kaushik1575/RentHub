document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    
    // DOM Elements
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const adminBtn = document.getElementById('adminBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const myBookingsBtn = document.getElementById('myBookingsBtn');
    const authModal = document.getElementById('authModal');
    const closeBtn = document.querySelector('.close');
    const showRegisterOptionsLink = document.getElementById('showRegisterOptions');
    const showLoginFromOptionsLink = document.getElementById('showLoginFromOptions');
    const loginForm = document.getElementById('loginForm');
    const registerOptions = document.getElementById('registerOptions');
    const loginActualForm = document.getElementById('loginActualForm');
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.querySelector('.password-group input');

    console.log('Elements found:', {
        loginBtn: !!loginBtn,
        registerBtn: !!registerBtn,
        authModal: !!authModal,
        closeBtn: !!closeBtn,
        loginForm: !!loginForm,
        registerOptions: !!registerOptions,
        loginActualForm: !!loginActualForm,
        togglePassword: !!togglePassword,
        passwordInput: !!passwordInput
    });

    // Password visibility toggle
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            togglePassword.classList.toggle('fa-eye');
            togglePassword.classList.toggle('fa-eye-slash');
        });
    }

    // Only add event listeners if the elements exist
    if (loginBtn) {
        console.log('Adding login button listener');
        loginBtn.addEventListener('click', () => {
            console.log('Login button clicked');
            showModal('login');
        });
    }
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (showRegisterOptionsLink) {
        showRegisterOptionsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('registerOptions');
        });
    }
    if (showLoginFromOptionsLink) {
        showLoginFromOptionsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showModal('login');
        });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (loginActualForm) {
        loginActualForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target[0].value;
            const password = e.target[1].value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();
                if (response.ok) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    updateAuthUI();
                    closeModal();
                    window.location.reload();
                } else {
                    alert(data.error || 'Login failed');
                }
            } catch (error) {
                alert('An error occurred. Please try again.');
            }
        });
    }

    if (myBookingsBtn) {
        myBookingsBtn.addEventListener('click', function(e) {
            const token = localStorage.getItem('token');
            if (!token) {
                e.preventDefault();
                window.location.href = 'login.html';
            }
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === authModal) {
            closeModal();
        }
    });

    // Functions
    function showModal(type) {
        console.log('Showing modal:', type);
        if (!authModal || !loginForm || !registerOptions) {
            console.log('Missing required elements:', {
                authModal: !!authModal,
                loginForm: !!loginForm,
                registerOptions: !!registerOptions
            });
            return;
        }
        
        authModal.style.display = 'block';
        loginForm.style.display = 'none';
        registerOptions.style.display = 'none';

        if (type === 'login') {
            loginForm.style.display = 'block';
        } else if (type === 'registerOptions') {
            registerOptions.style.display = 'block';
        }
    }

    function closeModal() {
        console.log('Closing modal');
        if (authModal) authModal.style.display = 'none';
    }

    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        updateAuthUI();
        window.location.href = 'login.html';
    }

    function updateAuthUI() {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = user.isAdmin === true;

        if (loginBtn) loginBtn.style.display = token ? 'none' : 'block';
        if (registerBtn) registerBtn.style.display = token ? 'none' : 'block';
        if (logoutBtn) logoutBtn.style.display = token ? 'block' : 'none';
        if (adminBtn) adminBtn.style.display = (token && isAdmin) ? 'block' : 'none';
    }

    // Initial UI update
    updateAuthUI();
}); 