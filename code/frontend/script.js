let tok = new URLSearchParams(window.location.search).get('token') || localStorage.getItem('authToken');

// Store the token in localStorage if retrieved from URL
if (tok && !localStorage.getItem('authToken')) {
    localStorage.setItem('authToken', tok);
}

// Redirect to login if no token
if (!tok) {
    alert('You are not logged in! Redirecting to login page...');
    window.location.href = '/';
}

// DOM Elements
const categorySelect = document.getElementById('category-select');
const amountInput = document.getElementById('amount-input');
const dateInput = document.getElementById('date-input');
const addBtn = document.getElementById('add-btn');
const expenseTableBody = document.getElementById('expense-table-body');
const totalAmount = document.getElementById('total-amount');

const pieChartContainer = document.getElementById('pieChartContainer');
const pieChartCanvas = document.getElementById('pieChartCanvas');
const lineChartContainer = document.getElementById('lineChartContainer');
const lineChartCanvas = document.getElementById('lineChartCanvas');
const barChartContainer = document.getElementById('barChartContainer');
const barChartCanvas = document.getElementById('barChartCanvas');
const monthSelect = document.getElementById('month-select');

const filterModal = new bootstrap.Modal(document.getElementById('filterModal'));
const openFilterDialog = document.getElementById('open-filter-dialog');
const applyFilters = document.getElementById('apply-filters');
const resetFilters = document.getElementById('reset-filters');


let pieChartInstance, lineChartInstance, barChartInstance;

// Function to load expenses
function loadExpenses() {
    fetch('http://localhost:3000/expenses', {
        headers: {
            Authorization: `Bearer ${tok}`,
        },
    })
        .then((response) => {
            if (!response.ok) throw new Error('Failed to load expenses.');
            return response.json();
        })
        .then((data) => {
            expenseTableBody.innerHTML = '';
            let total = 0;

            data.forEach((expense) => {
                const row = document.createElement('tr');
                const amount = parseFloat(expense.amount); // Explicitly parse amount as a number

                if (isNaN(amount)) {
                    console.error('Invalid amount:', expense.amount); // Debugging invalid data
                    return;
                }

                // Format the amount with a dollar sign
                const formattedAmount = `$${amount.toFixed(2)}`;

                row.innerHTML = `
                    <td>${expense.category}</td>
                    <td>${formattedAmount}</td>
                    <td>${new Date(expense.date).toLocaleDateString()}</td>
                    <td><button class="delete-btn" data-id="${expense.id}">Delete</button></td>
                `;
                expenseTableBody.appendChild(row);
                total += amount; // Safely add to the total
            });

            // Format and update the total amount
            totalAmount.textContent = `$${total.toFixed(2)}`;

            // Add event listeners to delete buttons
            document.querySelectorAll('.delete-btn').forEach((button) =>
                button.addEventListener('click', function () {
                    deleteExpense(this.dataset.id);
                })
            );
        })
        .catch((error) => console.error(error));
}

// Function to delete an expense
function deleteExpense(id) {
    fetch(`http://localhost:3000/delete-expense/${id}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${tok}`,
        },
    })
        .then((response) => {
            if (!response.ok) throw new Error('Failed to delete expense.');
            return response.json();
        })
        .then(() => {
            alert('Expense deleted successfully!');
            loadExpenses(); // Reload the expenses list after deletion
        })
        .catch((error) => alert(error.message));
}

// Open the filter dialog
openFilterDialog.addEventListener('click', () => {
    filterModal.show();
});

// Apply filters
applyFilters.addEventListener('click', () => {
    console.log('Apply Filters triggered');

    // Get selected categories from checkboxes
    const selectedCategories = Array.from(document.querySelectorAll('#filter-category input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value.toLowerCase().trim());

    console.log('Selected Categories:', selectedCategories); // Debug selected categories

    const dateFilter = document.getElementById('filter-date').value;
    const timeframeFilter = document.getElementById('filter-timeframe').value;

    const rows = expenseTableBody.querySelectorAll('tr');
    const now = new Date();

    rows.forEach(row => {
        const category = row.cells[0].textContent.toLowerCase().trim();
        console.log('Row Category:', category); // Debug row category

        // Match category (if no categories are selected, all rows match)
        let matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(category);
        console.log('Matches Category:', matchesCategory); // Debug category matching

        // Match date (exact match)
        const date = new Date(row.cells[2].textContent);
        let matchesDate = !dateFilter || date.toISOString().split('T')[0] === dateFilter;

        // Match timeframe
        let matchesTimeframe = true;
        if (timeframeFilter === 'last7days') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(now.getDate() - 7);
            matchesTimeframe = date >= sevenDaysAgo && date <= now;
        } else if (timeframeFilter === 'last30days') {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            matchesTimeframe = date >= thirtyDaysAgo && date <= now;
        } else if (timeframeFilter === 'thisMonth') {
            matchesTimeframe = date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        }

        console.log('Matches Date:', matchesDate, 'Matches Timeframe:', matchesTimeframe); // Debug other filters

        // Show or hide the row based on all filters
        if (matchesCategory && matchesDate && matchesTimeframe) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
    filterModal.hide(); // Close the modal after applying filters
});

// Reset filters
resetFilters.addEventListener('click', () => {
    console.log('Reset Filters triggered');

    // Clear all selected checkboxes
    document.querySelectorAll('#filter-category input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Clear date and timeframe filters
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-timeframe').value = '';

    // Show all rows in the table
    const rows = expenseTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        row.style.display = ''; // Reset visibility
    });
    filterModal.hide(); // Close the modal after applying filters
});

// Reset filters
resetFilters.addEventListener('click', () => {
    // Clear filter inputs
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-timeframe').value = '';

    // Show all rows in the table
    const rows = expenseTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        row.style.display = ''; // Reset visibility
    });
});

// Function to toggle and load the Pie Chart
document.getElementById('pie-chart-btn').addEventListener('click', () => {
    if (pieChartContainer.style.display === 'none' || pieChartContainer.style.display === '') {
        pieChartContainer.style.display = 'block';
        loadPieChart();
    } else {
        pieChartContainer.style.display = 'none';
    }
});

function loadPieChart() {
    fetch('http://localhost:3000/expenses', {
        headers: {
            Authorization: `Bearer ${tok}`,
        },
    })
        .then((response) => response.json())
        .then((data) => {
            const categoryTotals = data.reduce((acc, expense) => {
                acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount);
                return acc;
            }, {});

            const categories = Object.keys(categoryTotals);
            const amounts = Object.values(categoryTotals);

            createOrUpdatePieChart(categories, amounts);
        });
}

function createOrUpdatePieChart(categories, amounts) {
    const ctx = pieChartCanvas.getContext('2d');

    if (pieChartInstance) {
        pieChartInstance.data.labels = categories;
        pieChartInstance.data.datasets[0].data = amounts;
        pieChartInstance.update();
    } else {
        pieChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Expenses by Category',
                    data: amounts,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
                    hoverOffset: 4
                }]
            }
        });
    }
}

// Function to toggle and load the Line Chart
document.getElementById('line-chart-btn').addEventListener('click', () => {
    if (lineChartContainer.style.display === 'none' || lineChartContainer.style.display === '') {
        lineChartContainer.style.display = 'block';
        loadLineChart();
    } else {
        lineChartContainer.style.display = 'none';
    }
});


function loadLineChart() {
    fetch('http://localhost:3000/expenses', {
        headers: {
            Authorization: `Bearer ${tok}`,
        },
    })
        .then((response) => response.json())
        .then((data) => {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const monthlyTotals = Array(12).fill(0); // Initialize totals for all 12 months

            data.forEach((expense) => {
                const date = new Date(expense.date);
                const monthIndex = date.getMonth(); // Get month index (0 = January, 11 = December)
                monthlyTotals[monthIndex] += parseFloat(expense.amount);
            });

            createOrUpdateLineChart(months, monthlyTotals);
        });
}

function createOrUpdateLineChart(months, amounts) {
    const ctx = lineChartCanvas.getContext('2d');

    if (lineChartInstance) {
        // Update existing chart
        lineChartInstance.data.labels = months;
        lineChartInstance.data.datasets[0].data = amounts;
        lineChartInstance.update();
    } else {
        // Create a new chart
        lineChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Total Expenses by Month',
                    data: amounts,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Months',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Total Expense',
                        },
                    },
                },
            },
        });
    }
}


// Toggle and load Bar Chart
document.getElementById('bar-chart-btn').addEventListener('click', () => {
    if (barChartContainer.style.display === 'none' || barChartContainer.style.display === '') {
        barChartContainer.style.display = 'block'; // Show the container
        monthSelect.value = 'Month'; // Reset dropdown
        barChartCanvas.style.display = 'none';
        noDataMessage.style.display = 'block'; // Show no data message by default
    } else {
        barChartContainer.style.display = 'none'; // Hide the container
    }
});

// Event listener for the month dropdown
monthSelect.addEventListener('change', () => {
    const selectedMonth = monthSelect.value;
    if (selectedMonth === 'Month') {
        barChartCanvas.style.display = 'none';
        noDataMessage.style.display = 'block'; // Show no data message
    } else {
        loadBarChart(parseInt(selectedMonth)); // Load bar chart data
    }
});

// Load Bar Chart Data
function loadBarChart(month) {
    fetch('http://localhost:3000/expenses', {
        headers: { Authorization: `Bearer ${tok}` },
    })
        .then((response) => response.json())
        .then((data) => {
            const filteredData = data.filter(expense => new Date(expense.date).getMonth() === month);

            if (filteredData.length === 0) {
                barChartCanvas.style.display = 'none';
                noDataMessage.style.display = 'block';
                return;
            }

            noDataMessage.style.display = 'none'; // Hide no data message
            barChartCanvas.style.display = 'block'; // Show canvas

            const categoryTotals = filteredData.reduce((acc, expense) => {
                acc[expense.category] = (acc[expense.category] || 0) + parseFloat(expense.amount);
                return acc;
            }, {});

            const categories = Object.keys(categoryTotals);
            const amounts = Object.values(categoryTotals);

            createOrUpdateBarChart(categories, amounts, month);
        });
}

function createOrUpdateBarChart(categories, amounts, month) {
    const ctx = barChartCanvas.getContext('2d');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (categories.length === 0 || amounts.length === 0) {
        // No data scenario
        ctx.clearRect(0, 0, barChartCanvas.width, barChartCanvas.height); // Clear the canvas
        ctx.font = '16px Arial';
        ctx.fillStyle = '#555';
        ctx.textAlign = 'center';
        ctx.fillText(
            'No data available for the selected month',
            barChartCanvas.width / 2,
            barChartCanvas.height / 2
        );
        return;
    }

    if (barChartInstance) {
        // Update existing chart
        barChartInstance.data.labels = categories;
        barChartInstance.data.datasets[0].data = amounts;
        barChartInstance.options.plugins.title.text = months[month]; // Update the title
        barChartInstance.update();
    } else {
        // Create a new chart
        barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: 'Expenses',
                    data: amounts,
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: months[month], // Set the initial title based on the selected month
                        font: {
                            size: 18,
                        },
                    },
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Categories',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Expense Amount',
                        },
                    },
                },
            },
        });
    }
}
document.getElementById('signOutBtn').addEventListener('click', () => {
    // Clear localStorage
    localStorage.removeItem('authToken');

    // Clear the UI elements immediately
    document.getElementById('expense-table-body').innerHTML = '';
    document.getElementById('total-amount').textContent = '0';

    // Redirect to the login page after a short delay
    setTimeout(() => {
        window.location.href = '/'; // Redirect to your login page
    }, 100); // 100ms delay to allow UI updates
});

// Function to add an expense
addBtn.addEventListener('click', function () {
    const category = categorySelect.value;
    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;

    // Validate inputs
    if (!category || isNaN(amount) || !date) {
        alert('All fields are required!');
        return;
    }

    // Create expense object
    const expenseData = { category, amount, date };

    // Send POST request to backend
    fetch('http://localhost:3000/add-expense', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tok}`,
        },
        body: JSON.stringify(expenseData),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Failed to add expense: ${response.statusText}`);
            }
            return response.json();
        })
        .then((data) => {
            alert('Expense added successfully!');
            loadExpenses(); // Reload the table with updated expenses

            // Clear the input fields
            categorySelect.value = '';
            amountInput.value = '';
            dateInput.value = '';
        })
        .catch((error) => {
            console.error('Error adding expense:', error);
            alert('Failed to add expense. Please try again.');
        });
});

//Settings
document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const themeColorSelect = document.getElementById('themeColorSelect');
    const applySettingsBtn = document.getElementById('applySettingsBtn');
    const root = document.documentElement; // Access CSS root for setting variables

    // Load and apply saved settings
    const darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    const savedThemeColor = localStorage.getItem('themeColor') || '#4CAF50';

    // Apply saved Dark Mode
    if (darkModeEnabled) {
        document.body.classList.add('dark-mode');
        darkModeToggle.checked = true;
    }

    // Apply saved Theme Color
    root.style.setProperty('--primary-color', savedThemeColor);
    themeColorSelect.value = savedThemeColor;

    // Apply settings on button click
    applySettingsBtn.addEventListener('click', () => {
        // Save Dark Mode preference
        if (darkModeToggle.checked) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('darkMode', 'true');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('darkMode', 'false');
        }

        // Save Theme Color preference
        const selectedColor = themeColorSelect.value;
        localStorage.setItem('themeColor', selectedColor);

        // Apply the new color to the root CSS variable
        root.style.setProperty('--primary-color', selectedColor);

        // Reload the page to ensure all styles are updated
        location.reload();
    });
});

// Load expenses on page load
window.onload = loadExpenses;
