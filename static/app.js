document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const earliestStartInput = document.getElementById('earliest_start');
    const latestReturnInput = document.getElementById('latest_return');
    const destContainer = document.getElementById('destinations-container');
    const addDestBtn = document.getElementById('add-dest-btn');
    const resultsContainer = document.getElementById('results');
    const loader = document.getElementById('loader');

    // Autocomplete Logic
    function setupAutocomplete(inputElement, suggestionsElement) {
        let timeout = null;

        inputElement.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                suggestionsElement.classList.add('hidden');
                return;
            }

            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${query}&locale=de&types[]=airport`);
                    const data = await res.json();
                    
                    if (data.length > 0) {
                        suggestionsElement.innerHTML = '';
                        data.forEach(item => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.innerHTML = `<span class="suggestion-name">${item.name}</span> <span class="suggestion-code">${item.code}</span>`;
                            div.addEventListener('click', () => {
                                inputElement.value = item.code;
                                suggestionsElement.classList.add('hidden');
                            });
                            suggestionsElement.appendChild(div);
                        });
                        suggestionsElement.classList.remove('hidden');
                    } else {
                        suggestionsElement.classList.add('hidden');
                    }
                } catch (err) {
                    console.error("Autocomplete error", err);
                }
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (e.target !== inputElement && !suggestionsElement.contains(e.target)) {
                suggestionsElement.classList.add('hidden');
            }
        });
    }

    // Initialize static autocomplete
    setupAutocomplete(document.getElementById('start_airport'), document.getElementById('start-suggestions'));
    setupAutocomplete(document.getElementById('end_airport'), document.getElementById('end-suggestions'));

    // Date validation
    earliestStartInput.addEventListener('change', () => {
        latestReturnInput.min = earliestStartInput.value;
        if (latestReturnInput.value && latestReturnInput.value < earliestStartInput.value) {
            latestReturnInput.value = earliestStartInput.value;
        }
    });

    let destCount = 0;

    function addDestination() {
        destCount++;
        const row = document.createElement('div');
        row.className = 'destination-row';
        row.innerHTML = `
            <h4>Zwischenstopp ${destCount}</h4>
            <button type="button" class="remove-btn">Entfernen</button>
            <div class="form-group" style="position: relative;">
                <label>Nach (Flughafen-Code)</label>
                <input type="text" class="dest-airport" placeholder="z.B. ROM" autocomplete="off" required>
                <div class="suggestions-box hidden"></div>
            </div>
            <div style="display:flex; gap:1rem; margin-top:0.5rem;">
                <div class="form-group">
                    <label>Min. Aufenthalt (Tage)</label>
                    <input type="number" class="dest-min" min="1" value="3" required>
                </div>
                <div class="form-group">
                    <label>Max. Aufenthalt (Tage)</label>
                    <input type="number" class="dest-max" min="1" value="6" required>
                </div>
            </div>
        `;

        destContainer.appendChild(row);

        // Setup autocomplete for this new input
        const input = row.querySelector('.dest-airport');
        const box = row.querySelector('.suggestions-box');
        setupAutocomplete(input, box);

        // Setup remove button
        row.querySelector('.remove-btn').addEventListener('click', () => {
            row.remove();
        });
    }

    // Add one default destination
    addDestination();

    addDestBtn.addEventListener('click', addDestination);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Gather data
        const earliest_start = earliestStartInput.value;
        const latest_return = latestReturnInput.value;
        const start_airport = document.getElementById('start_airport').value;
        const end_airport = document.getElementById('end_airport').value || "";

        const destinations = [];
        document.querySelectorAll('.destination-row').forEach(row => {
            destinations.push({
                airport: row.querySelector('.dest-airport').value,
                min_days: parseInt(row.querySelector('.dest-min').value),
                max_days: parseInt(row.querySelector('.dest-max').value)
            });
        });

        const requestData = {
            earliest_start,
            latest_return,
            start_airport,
            end_airport,
            destinations
        };

        resultsContainer.innerHTML = '';
        form.style.display = 'none';
        loader.classList.remove('hidden');

        try {
            const response = await fetch('/api/smart-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            const data = await response.json();
            
            loader.classList.add('hidden');
            form.style.display = 'block';

            if (data.status === 'success' && data.data.length > 0) {
                data.data.forEach(flight => {
                    const card = document.createElement('div');
                    card.className = 'flight-card glass';
                    
                    let layoversHtml = '';
                    if (flight.layovers > 0) {
                        layoversHtml = `<div class="flight-detail"><strong>Layovers:</strong> ${flight.layovers}</div>`;
                    } else {
                        layoversHtml = `<div class="flight-detail" style="color: #4ade80;"><strong>Direktflüge!</strong></div>`;
                    }

                    const routeHtml = flight.route.map((r, i) => `<div>Leg ${i+1}: ${r}</div>`).join('');

                    card.innerHTML = `
                        <div class="flight-header">
                            <div class="flight-price">${flight.price} ${flight.currency}</div>
                            <a href="${flight.deep_link}" target="_blank" class="book-btn">Prüfen</a>
                        </div>
                        <div style="color:var(--primary-color); margin-bottom:1rem; font-weight:600; font-size:0.9rem;">
                            ${flight.date_summary}
                        </div>
                        <div class="flight-details">
                            <div class="flight-detail">
                                <strong>Start:</strong> ${flight.departure}
                            </div>
                            <div class="flight-detail">
                                <strong>Ende:</strong> ${flight.arrival}
                            </div>
                            <div class="flight-detail">
                                <strong>Route:</strong>
                                ${routeHtml}
                            </div>
                            ${layoversHtml}
                        </div>
                    `;
                    resultsContainer.appendChild(card);
                });
            } else {
                resultsContainer.innerHTML = '<p style="text-align: center;">Keine guten Kombinationen mit passenden Kriterien gefunden.</p>';
            }
        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            form.style.display = 'block';
            resultsContainer.innerHTML = '<p style="text-align: center; color: #ef4444;">Fehler bei der Suche.</p>';
        }
    });
});
