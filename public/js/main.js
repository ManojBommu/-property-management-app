document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the index page with properties
    const propertyGrid = document.getElementById('propertyGrid');
    
    if (propertyGrid) {
        fetchProperties();
        
        // Filter logic mock
        const searchInput = document.getElementById('searchLocation');
        const priceSelect = document.getElementById('priceRange');
        const typeSelect = document.getElementById('propertyType');
        
        [searchInput, priceSelect, typeSelect].forEach(el => {
            if (el) {
                el.addEventListener('change', fetchProperties);
                el.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') fetchProperties();
                });
            }
        });
    }
});

async function fetchProperties() {
    try {
        const response = await fetch('/api/properties');
        const properties = await response.json();
        
        const propertyGrid = document.getElementById('propertyGrid');
        propertyGrid.innerHTML = ''; // Clear current
        
        properties.forEach(prop => {
            const card = document.createElement('div');
            card.className = 'property-card glass-panel';
            
            card.innerHTML = `
                <img src="${prop.image}" alt="${prop.title}" class="property-img">
                <div class="property-info">
                    <div class="property-price">$${prop.rent}<span>/month</span></div>
                    <h3>${prop.title}</h3>
                    <p>${prop.available ? '<span style="color: var(--success)">Available Now</span>' : '<span style="color: var(--danger)">Leased</span>'}</p>
                    <div class="property-tags">
                        ${prop.amenities.map(a => `<span class="tag">${a}</span>`).join('')}
                    </div>
                </div>
            `;
            
            propertyGrid.appendChild(card);
        });
    } catch (error) {
        console.error("Error fetching properties:", error);
    }
}
