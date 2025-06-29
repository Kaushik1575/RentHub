// Welcome Message Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Function to clear cache and force fresh login
    function clearCacheAndReload() {
        console.log('🧹 Clearing cache and reloading...');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('adminToken');
        window.location.reload();
    }
    
    // Function to create and display welcome message
    function displayWelcomeMessage() {
        const token = localStorage.getItem('token');
        const adminToken = localStorage.getItem('adminToken');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Debug logging
        console.log('=== WELCOME MESSAGE DEBUG ===');
        console.log('Token exists:', !!token);
        console.log('Admin token exists:', !!adminToken);
        console.log('Full user object:', user);
        console.log('User keys:', Object.keys(user));
        console.log('fullName value:', user.fullName);
        console.log('adminName value:', user.adminName);
        console.log('name value:', user.name);
        console.log('email value:', user.email);
        console.log('isAdmin value:', user.isAdmin);
        console.log('=============================');
        
        // Show welcome message if user is logged in (either regular user or admin)
        if ((token || adminToken) && user) {
            // Get the username from user data - prioritize fullName for regular users
            let username = '';
            let source = '';
            
            if (user.fullName) {
                // Extract first name from fullName (e.g., "Kaushik Sharma" -> "Kaushik")
                username = user.fullName.split(' ')[0];
                source = 'fullName';
                console.log('✅ Using fullName:', user.fullName, '-> username:', username);
            } else if (user.adminName) {
                // Extract first name from adminName
                username = user.adminName.split(' ')[0];
                source = 'adminName';
                console.log('✅ Using adminName:', user.adminName, '-> username:', username);
            } else if (user.name) {
                // Extract first name from name
                username = user.name.split(' ')[0];
                source = 'name';
                console.log('✅ Using name:', user.name, '-> username:', username);
            } else if (user.email) {
                // Extract username from email (e.g., "kaushik@gmail.com" -> "kaushik")
                username = user.email.split('@')[0];
                source = 'email';
                console.log('⚠️ Using email:', user.email, '-> username:', username);
                
                // If we're using email, it means fullName is missing - suggest clearing cache
                console.log('💡 Suggestion: Try clearing cache and logging in again');
                console.log('💡 You can call clearCacheAndReload() in console to do this automatically');
            } else {
                username = 'User';
                source = 'fallback';
                console.log('❌ Using fallback username:', username);
            }
            
            // Determine if it's an admin user
            const isAdmin = user.isAdmin === true || adminToken;
            
            // Create welcome message text
            const welcomeText = isAdmin ? `Welcome Admin ${username}` : `Welcome Mr. ${username}`;
            console.log('🎯 Final welcome text:', welcomeText, '(source:', source, ')');
            
            // Create welcome message element
            const welcomeDiv = document.createElement('div');
            welcomeDiv.id = 'welcome-message';
            welcomeDiv.innerHTML = `<span>${welcomeText}</span>`;
            welcomeDiv.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 25px;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                animation: slideInRight 0.5s ease-out;
                max-width: 300px;
                text-align: center;
            `;
            
            // Add animation keyframes
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                
                @media (max-width: 768px) {
                    #welcome-message {
                        top: 70px;
                        right: 10px;
                        left: 10px;
                        max-width: none;
                        font-size: 12px;
                        padding: 8px 15px;
                    }
                }
            `;
            document.head.appendChild(style);
            
            // Add to page
            document.body.appendChild(welcomeDiv);
            
            // Remove auto-hide functionality - message stays until logout
        } else {
            console.log('❌ No user logged in or no user data available');
        }
    }
    
    // Function to remove welcome message (for logout)
    function removeWelcomeMessage() {
        const welcomeDiv = document.getElementById('welcome-message');
        if (welcomeDiv && welcomeDiv.parentNode) {
            welcomeDiv.style.animation = 'slideOutRight 0.5s ease-in forwards';
            const slideOutStyle = document.createElement('style');
            slideOutStyle.textContent = `
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(slideOutStyle);
            
            setTimeout(() => {
                if (welcomeDiv.parentNode) {
                    welcomeDiv.parentNode.removeChild(welcomeDiv);
                }
            }, 500);
        }
    }
    
    // Display welcome message on page load
    displayWelcomeMessage();
    
    // Listen for storage changes (when user logs in/out from another tab)
    window.addEventListener('storage', (e) => {
        if (e.key === 'token' || e.key === 'adminToken' || e.key === 'user') {
            if (e.newValue) {
                // User logged in
                setTimeout(displayWelcomeMessage, 100);
            } else {
                // User logged out
                removeWelcomeMessage();
            }
        }
    });
    
    // Make functions globally available for other scripts
    window.displayWelcomeMessage = displayWelcomeMessage;
    window.removeWelcomeMessage = removeWelcomeMessage;
    window.clearCacheAndReload = clearCacheAndReload;
}); 