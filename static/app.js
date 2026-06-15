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

    // Autocomplete Logic
    function setupAutocomplete(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const box = document.getElementById(suggestionsId);
        let timeout = null;

        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                box.classList.add('hidden');
                return;
            }

            timeout = setTimeout(async () => {
                try {
                    // Wir nutzen eine kostenlose offene API für Flughäfen, um keine SerpApi Credits zu verbrauchen!
                    const res = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${query}&locale=de&types[]=city,airport`);
                    const data = await res.json();
                    
                    if (data.length > 0) {
                        box.innerHTML = '';
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerHTML = `<span class="suggestion-name">${item.name}</span> <span class="suggestion-code">${item.code}</span>`;
                            div.addEventListener('click', () => {
                                input.value = item.code; // Setze den Code (z.B. FRA) ein, den die API braucht
                                box.classList.add('hidden');
                            });
                            box.appendChild(div);
                        });
                        box.classList.remove('hidden');
                    } else {
                        box.classList.add('hidden');
                    }
                } catch (err) {
                    console.error("Autocomplete error", err);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== input && !box.contains(e.target)) {
                box.classList.add('hidden');
            }
        });
    }

    setupAutocomplete('origin', 'origin-suggestions');
    setupAutocomplete('destination', 'destination-suggestions');

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
