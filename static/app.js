document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const isRoundtrip = document.getElementById('is_roundtrip');
    const returnDates = document.getElementById('return-dates');
    const resultsContainer = document.getElementById('results');
    const loader = document.getElementById('loader');

    isRoundtrip.addEventListener('change', (e) => {
        if (e.target.checked) {
            returnDates.classList.remove('hidden');
            document.getElementById('return_from').required = true;
        } else {
            returnDates.classList.add('hidden');
            document.getElementById('return_from').required = false;
        }
    });

    // Helper to format date YYYY-MM-DD to DD/MM/YYYY
    const formatDate = (dateString) => {
        if (!dateString) return null;
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        resultsContainer.innerHTML = '';
        loader.classList.remove('hidden');

        const origin = document.getElementById('origin').value.toUpperCase();
        const destination = document.getElementById('destination').value.toUpperCase();
        const dateFrom = formatDate(document.getElementById('date_from').value);
        
        let url = `/api/search?origin=${origin}&destination=${destination}&date_from=${dateFrom}`;
        
        if (isRoundtrip.checked) {
            const returnFrom = formatDate(document.getElementById('return_from').value);
            url += `&return_from=${returnFrom}`;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            loader.classList.add('hidden');
            
            if (data.status === 'success') {
                renderResults(data.data);
            } else {
                resultsContainer.innerHTML = `<p style="color: #ef4444; text-align: center;">Fehler bei der Suche: ${data.message}</p>`;
            }
        } catch (error) {
            loader.classList.add('hidden');
            resultsContainer.innerHTML = `<p style="color: #ef4444; text-align: center;">Ein Netzwerkfehler ist aufgetreten.</p>`;
        }
    });

    function renderResults(flights) {
        if (!flights || flights.length === 0) {
            resultsContainer.innerHTML = `<p style="text-align: center; color: #cbd5e1;">Keine Flüge mit passenden Kriterien gefunden.</p>`;
            return;
        }

        const isMockData = flights[0].id && flights[0].id.startsWith('mock');
        let html = '';
        
        if (isMockData) {
            html += `<div class="glass" style="margin-bottom: 1rem; border-color: #f59e0b; padding: 1rem; text-align: center;">
                        <span style="color: #fbbf24;">⚠️ API Key nicht gesetzt. Zeige Mock-Daten an.</span>
                     </div>`;
        }

        flights.forEach(flight => {
            const routeStr = flight.route.join('<br>');
            html += `
                <div class="flight-card">
                    <div class="flight-info">
                        <h3>Abflug: ${flight.departure} | Ankunft: ${flight.arrival}</h3>
                        <p><strong>Dauer:</strong> ${flight.duration} | <strong>Stopps:</strong> ${flight.layovers}</p>
                        <p style="margin-top: 0.5rem; font-size: 0.85rem;">${routeStr}</p>
                    </div>
                    <div class="flight-price">
                        <span class="amount">${flight.price} ${flight.currency}</span>
                        <a href="${flight.deep_link}" target="_blank" class="book-btn">Buchen</a>
                    </div>
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
    }
});
