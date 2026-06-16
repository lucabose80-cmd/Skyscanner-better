document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('search-form');
    const earliestStartInput = document.getElementById('earliest_start');
    const latestReturnInput = document.getElementById('latest_return');
    const destContainer = document.getElementById('destinations-container');
    const addDestBtn = document.getElementById('add-dest-btn');
    const resultsContainer = document.getElementById('results');
    const loader = document.getElementById('loader');
    
    const comboView = document.getElementById('combo-view');
    const comboList = document.getElementById('combo-list');
    const fetchFlightsBtn = document.getElementById('fetch-flights-btn');
    const comboCountSpan = document.getElementById('combo-count');

    let generatedCombosData = [];
    let selectedCombos = [];

    // Autocomplete Logic
    function setupAutocomplete(inputElement, suggestionsElement) {
        let timeout = null;

        // Bringe das aktuelle Feld in den Vordergrund, damit das Dropdown nicht hinter dem nächsten Feld verschwindet
        inputElement.addEventListener('focus', () => {
            const rowOrGroup = inputElement.closest('.destination-row') || inputElement.closest('.form-group');
            if (rowOrGroup) rowOrGroup.style.zIndex = '50';
        });

        inputElement.addEventListener('blur', () => {
            setTimeout(() => {
                const rowOrGroup = inputElement.closest('.destination-row') || inputElement.closest('.form-group');
                if (rowOrGroup) rowOrGroup.style.zIndex = '';
            }, 200);
        });

        inputElement.addEventListener('input', (e) => {
            clearTimeout(timeout);
            const query = e.target.value.trim();
            
            if (query.length < 2) {
                suggestionsElement.classList.add('hidden');
                return;
            }

            timeout = setTimeout(async () => {
                try {
                    const res = await fetch(`https://autocomplete.travelpayouts.com/places2?term=${query}&locale=de&types[]=city&types[]=airport`);
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
        loader.querySelector('p').innerText = "Berechne Kombinationsmöglichkeiten...";

        try {
            const response = await fetch('/api/generate-combos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });
            const data = await response.json();
            
            loader.classList.add('hidden');

            if (data.status === 'success' && data.data.length > 0) {
                generatedCombosData = data.data;
                renderCombos();
                comboView.classList.remove('hidden');
            } else {
                form.style.display = 'block';
                resultsContainer.innerHTML = '<p style="text-align: center;">Keine mathematisch gültigen Kombinationen in diesem Zeitraum gefunden.</p>';
            }
        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            form.style.display = 'block';
            resultsContainer.innerHTML = '<p style="text-align: center; color: #ef4444;">Fehler bei der Kombinationengenerierung.</p>';
        }
    });

    function renderCombos() {
        comboList.innerHTML = '';
        selectedCombos = [];
        updateFetchButton();

        generatedCombosData.forEach(combo => {
            const div = document.createElement('div');
            div.className = 'combo-item';
            
            const badge = combo.recommended ? '<span class="recommended-badge">⭐ Empfohlen</span>' : '';
            
            div.innerHTML = `
                <input type="checkbox" class="combo-checkbox" value="${combo.combo_id}" id="${combo.combo_id}">
                <label for="${combo.combo_id}" style="cursor:pointer; width:100%; font-weight:500;">
                    ${combo.route_summary}
                    ${badge}
                </label>
            `;

            const checkbox = div.querySelector('.combo-checkbox');
            
            // Allow clicking the whole div
            div.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (selectedCombos.length >= 10) {
                        checkbox.checked = false;
                        alert("Du kannst maximal 10 Kombinationen gleichzeitig abfragen!");
                        return;
                    }
                    selectedCombos.push(combo);
                    div.classList.add('selected');
                } else {
                    selectedCombos = selectedCombos.filter(c => c.combo_id !== combo.combo_id);
                    div.classList.remove('selected');
                }
                updateFetchButton();
            });

            comboList.appendChild(div);
        });
    }

    function updateFetchButton() {
        comboCountSpan.innerText = selectedCombos.length;
        if (selectedCombos.length > 0) {
            fetchFlightsBtn.disabled = false;
        } else {
            fetchFlightsBtn.disabled = true;
        }
    }

    fetchFlightsBtn.addEventListener('click', async () => {
        comboView.classList.add('hidden');
        loader.classList.remove('hidden');
        loader.querySelector('p').innerText = "Frage reale Preise bei Google Flights ab... (Das kann kurz dauern)";

        const maxLayover = parseInt(document.getElementById('max_layover').value);

        try {
            const response = await fetch('/api/fetch-flights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selected_combos: selectedCombos, max_layover: maxLayover })
            });
            const data = await response.json();
            
            loader.classList.add('hidden');
            comboView.classList.remove('hidden'); // Show combos again so they can pick others if they want

            if (data.status === 'success') {
                if (data.data.length > 0) {
                    resultsContainer.innerHTML = '<h2 style="margin-bottom: 1rem;">Gefundene Flüge</h2>';
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
                    resultsContainer.innerHTML = '<p style="text-align: center;">Für diese Auswahl wurden keine Flüge gefunden (oder sie verstoßen gegen dein Layover Limit).</p>';
                }
            } else {
                resultsContainer.innerHTML = `<p style="text-align: center; color: #ef4444;">Fehler vom Server: ${data.message}</p>`;
            }
        } catch (error) {
            console.error(error);
            loader.classList.add('hidden');
            comboView.classList.remove('hidden');
            resultsContainer.innerHTML = '<p style="text-align: center; color: #ef4444;">Fehler bei der Flugsuche.</p>';
        }
    });

});
