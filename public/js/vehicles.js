document.addEventListener('DOMContentLoaded', () => {
    const bikesGrid = document.getElementById('bikesGrid');
    const scootersGrid = document.getElementById('scootyGrid');
    const carsGrid = document.getElementById('carsGrid');

    async function loadAndDisplayVehicles() {
        try {
            // Fetch bikes
            const bikesRes = await fetch('/api/vehicles/bikes');
            const bikes = await bikesRes.json();
            if (bikesGrid) {
                bikesGrid.innerHTML = ''; 
                bikes.filter(bike => bike.is_available).forEach(bike => {
                    bikesGrid.innerHTML += createVehicleCardHtml(bike, 'bike');
                });
            }

            // Fetch scooters
            const scootersRes = await fetch('/api/vehicles/scooty');
            const scooters = await scootersRes.json();
            if (scootersGrid) {
                scootersGrid.innerHTML = '';
                scooters.filter(scooter => scooter.is_available).forEach(scooter => {
                    scootersGrid.innerHTML += createVehicleCardHtml(scooter, 'scooty');
                });
            }
            
            // Fetch cars
            const carsRes = await fetch('/api/vehicles/cars');
            const cars = await carsRes.json();
            if (carsGrid) {
                carsGrid.innerHTML = '';
                cars.filter(car => car.is_available).forEach(car => {
                    carsGrid.innerHTML += createVehicleCardHtml(car, 'car');
                });
            }

        } catch (error) {
            console.error('Error loading vehicle data:', error);
            if(bikesGrid) bikesGrid.innerHTML = '<p class="error-message">Could not load vehicle listings.</p>';
            if(scootersGrid) scootersGrid.innerHTML = '<p class="error-message">Could not load scooty listings.</p>';
            if(carsGrid) carsGrid.innerHTML = '<p class="error-message">Could not load car listings.</p>';
        }
    }

    function createVehicleCardHtml(vehicle, type) {
        return `
            <div class="vehicle-card" data-id="${vehicle.id}" data-type="${type}">
                <img src="${vehicle.image_url}" alt="${vehicle.name}">
                <div class="vehicle-details">
                    <h3>${vehicle.name}</h3>
                    <p class="engine-detail"><i class="fas fa-engine"></i> Engine: ${vehicle.engine}</p>
                    <p class="fuel-detail"><i class="fas fa-gas-pump"></i> Fuel: ${vehicle.fuel_type}</p>
                    <div class="vehicle-price">
                        <p>Price per day</p>
                        <p>₹${vehicle.price.toFixed(2)}</p>
                    </div>
                </div>
                ${!vehicle.is_available
                    ? '<button class="btn btn-secondary" disabled style="background:#aaa;cursor:not-allowed;opacity:0.7;">Unavailable</button>'
                    : `<a href="booking-form.html?vehicleId=${vehicle.id}&type=${type}" class="btn btn-primary">Book Now</a>`
                }
            </div>
        `;
    }

    loadAndDisplayVehicles();
});