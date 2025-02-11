const svgNS = "http://www.w3.org/2000/svg";
let svg;
let tileStats = {};

// Function to generate a random color
function getRandomColor() {
    return `hsl(${Math.random() * 360}, 70%, 60%)`; // Bright and distinct colors
}

// Load JSON and Initialize the Map
function loadMapData(url) {
    fetch(url)
        .then(response => response.json())
        .then(mapData => {
            createSVG(mapData);
            initTileStats(mapData);
            addEventListenersToCountries();
        })
        .catch(error => console.error("Error loading JSON:", error));
}

// Create an SVG element and append regions
function createSVG(mapData) {
    svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100vw");
    svg.setAttribute("height", "100vh");
    svg.setAttribute("viewBox", "0 0 2000 1500"); // Adjust to fit map
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    mapData.regions.forEach(region => {
        const path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", region.path);
        path.setAttribute("fill", "gray"); // Assign a unique random color
        path.setAttribute("stroke", "black");
        path.setAttribute("stroke-width", "0.2");
        path.setAttribute("id", region.id);
        svg.appendChild(path);
    });

    document.body.appendChild(svg);

    // Initialize zoom with fixed limits
    const panZoom = svgPanZoom(svg, {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
        minZoom: 5,  // Ensures a fixed minimum zoom
        maxZoom: 25,  // Prevents excessive zooming out or in
        zoomScaleSensitivity: 0.2 // Adjusts how fast zooming happens
    });

    // Force zoom to max level on load
    panZoom.zoom(panZoom.getMaxZoom());
}

// Initialize tile stats from JSON
function initTileStats(mapData) {
    mapData.regions.forEach(region => {
        tileStats[region.id] = {
            owner: null,
            troops: 0,
            terrain: region.terrain || "plain"
        };
    });
}

// Add event listeners to tiles
function addEventListenersToCountries() {
    const countries = svg.querySelectorAll("path");
    countries.forEach(country => {
        country.addEventListener("click", () => {
            const id = country.id;
            alert(`Region ID: ${id}\nTile stats: ${JSON.stringify(tileStats[id], null, 2)}`);
            country.setAttribute("fill", "lightblue"); // Change color on click
        });
    });
}

// Start the game on load
document.addEventListener("DOMContentLoaded", () => {
    loadMapData("assets/map.json");
});
