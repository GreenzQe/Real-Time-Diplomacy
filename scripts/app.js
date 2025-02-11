const svgNS = "http://www.w3.org/2000/svg";
const BASE_SPEED = 100;
const WATER_MULTIPLIER = 0.5;
const ENEMY_TERRITORY_MULTIPLIER = 1 / 3;

let svg;
let tileStats = {};
let units = [];
let panZoomInstance;
let currentZoom = 1;
let destination = null;
let selectedUnit = null;

document.addEventListener("DOMContentLoaded", () => {
  loadMapData("assets/map.json");
  setInterval(updateTime, 1000);
});


function handleMoveUnitBtnClick() {
  if (destination) {
    moveSelectedUnitToDestination(destination);
    destination = null;
  } else {
    alert("Please select a destination on the map first.");
  }
}

function handleMapContainerClick(event) {
    if (selectedUnit) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
  
      // Get the transformation matrix applied by svg-pan-zoom
      const screenCTM = svg.getScreenCTM().inverse();
  
      // Transform the point to SVG coordinates
      const svgPoint = point.matrixTransform(screenCTM);
  
      destination = { x: svgPoint.x, y: svgPoint.y };
      console.log("Destination selected:", destination);
  
      // Draw a test circle at the destination
      const testCircle = document.createElementNS(svgNS, "circle");
      testCircle.setAttribute("cx", destination.x);
      testCircle.setAttribute("cy", destination.y);
      testCircle.setAttribute("r", 1);
      testCircle.setAttribute("fill", "yellow");
      svg.querySelector('#unitsGroup').appendChild(testCircle);
    }
  }
  
  function loadMapData(url) {
    fetch(url)
      .then(response => response.json())
      .then(mapData => {
        createSVG(mapData);
        tileStats(mapData);
        addUnitToRegion("Jutland_01", "Player1");
        updatePlayerStats();
      })
      .catch(error => console.error("Error loading JSON:", error));
  }
  
  function setupEventListeners() {
    document.getElementById("createUnitBtn").addEventListener("click", () => addUnitToRegion("Jutland_01", "Player1"));
    document.getElementById("tradeBtn").addEventListener("click", () => alert("Trade action triggered!"));
    document.getElementById("moveUnitBtn").addEventListener("click", handleMoveUnitBtnClick);
    document.getElementById("mapContainer").addEventListener("click", handleMapContainerClick);
  
    // Attach click event to the SVG element
    svg.addEventListener("click", handleMapContainerClick);
  }
  
  

  function createSVG(mapData) {
    svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  
    // Create a defs element if you use gradients or other definitions
    const defs = document.createElementNS(svgNS, "defs");
    svg.appendChild(defs);
  
    // Create the viewport group
    const viewportGroup = document.createElementNS(svgNS, "g");
    viewportGroup.setAttribute("id", "viewport");
    svg.appendChild(viewportGroup);
  
    // Create regions group inside viewport
    const regionsGroup = document.createElementNS(svgNS, "g");
    regionsGroup.setAttribute("id", "regionsGroup");
    viewportGroup.appendChild(regionsGroup);
  
    // Create units group inside viewport
    const unitsGroup = document.createElementNS(svgNS, "g");
    unitsGroup.setAttribute("id", "unitsGroup");
    viewportGroup.appendChild(unitsGroup);
  
    // Now create your map regions
    mapData.regions.forEach(region => {
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", region.path);
      path.setAttribute("fill", "gray");
      path.setAttribute("stroke", "black");
      path.setAttribute("stroke-width", "0.1");
      path.setAttribute("id", region.id);
      regionsGroup.appendChild(path);
    });
  
    document.getElementById("mapContainer").appendChild(svg);
    setupTooltip();
    setupZoom(); // Ensure this is called here
    setupEventListeners(); // Ensure this is called here
  }
  

function setupTooltip() {
  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.padding = "10px";
  tooltip.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
  tooltip.style.color = "white";
  tooltip.style.borderRadius = "5px";
  tooltip.style.visibility = "hidden";
  tooltip.style.pointerEvents = "none";
  document.body.appendChild(tooltip);

  svg.querySelectorAll("path").forEach(country => {
    const regionId = country.id;
    const originalColor = country.getAttribute("fill");

    country.addEventListener("mouseover", event => showTooltip(event, regionId, tooltip, originalColor));
    country.addEventListener("mouseleave", () => hideTooltip(tooltip, country, originalColor));
  });
}

function showTooltip(event, regionId, tooltip, originalColor) {
  const region = tileStats[regionId];
  tooltip.textContent = `Region ID: ${regionId}\nTile stats: ${JSON.stringify(region, null, 2)}`;
  tooltip.style.visibility = "visible";
  tooltip.style.left = `${event.pageX + 10}px`;
  tooltip.style.top = `${event.pageY + 10}px`;

  const gradientId = `gradient-${regionId}`;
  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(svgNS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }
  const radialGradient = createRadialGradient(gradientId, originalColor);
  defs.appendChild(radialGradient);
  event.target.setAttribute("fill", `url(#${gradientId})`);
}

function hideTooltip(tooltip, country, originalColor) {
  tooltip.style.visibility = "hidden";
  country.setAttribute("fill", originalColor);
}

function createRadialGradient(id, color) {
  const radialGradient = document.createElementNS(svgNS, "radialGradient");
  radialGradient.setAttribute("id", id);
  radialGradient.setAttribute("cx", "50%");
  radialGradient.setAttribute("cy", "50%");
  radialGradient.setAttribute("r", "90%");
  radialGradient.setAttribute("fx", "50%");
  radialGradient.setAttribute("fy", "50%");

  const stop1 = document.createElementNS(svgNS, "stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", color);
  radialGradient.appendChild(stop1);

  const stop2 = document.createElementNS(svgNS, "stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", "lightblue");
  radialGradient.appendChild(stop2);

  return radialGradient;
}

function setupZoom() {
    panZoomInstance = svgPanZoom(svg, {
      viewportSelector: '#viewport',
      panEnabled: true,
      controlIconsEnabled: true,
      zoomEnabled: true,
      dblClickZoomEnabled: true,
      mouseWheelZoomEnabled: true,
      preventMouseEventsDefault: false, // Allow events to propagate
      zoomScaleSensitivity: 0.2,
      minZoom: 0.5,
      maxZoom: 10,
      fit: true,
      center: true,
    });
  }
  
  

function createUnit(regionId, position, health, owner) {
  return {
    id: `${regionId}-unit`,
    regionId: regionId,
    position: position,
    health: health,
    owner: owner,
    element: null,
    isTraveling: false,
    travelTime: 0,
  };
}

function renderUnit(unit) {
    const ownerColor = unit.owner === "Player1" ? "red" : unit.owner === "Player2" ? "blue" : "gray";
    const unitElement = document.createElementNS(svgNS, "circle");
    unitElement.setAttribute("cx", unit.position.x);
    unitElement.setAttribute("cy", unit.position.y);
    unitElement.setAttribute("r", 1);
    unitElement.setAttribute("fill", ownerColor);
    unitElement.setAttribute("stroke", "black");
    unitElement.setAttribute("stroke-width", "0.1");
  
    const unitsGroup = svg.querySelector("#unitsGroup");
    unitsGroup.appendChild(unitElement);
  
    unit.element = unitElement;
    unitElement.addEventListener("click", () => selectUnit(unit));
  }
  

function addUnitToRegion(regionId, owner) {
  const region = svg.querySelector(`#${regionId}`);
  if (region) {
    const bbox = region.getBBox();
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    const unit = createUnit(regionId, { x: centerX, y: centerY }, 100, owner);
    renderUnit(unit);
    units.push(unit);
    updatePlayerStats();
  }
}

function selectUnit(unit) {
  const unitInfoPanel = document.getElementById("unitInfoPanel");
  unitInfoPanel.style.display = "block";
  document.getElementById("unitHealth").textContent = `Health: ${unit.health}`;
  document.getElementById("unitTravelTime").textContent = unit.isTraveling ? `Travel Time: ${unit.travelTime}s` : "Travel Time: -";
  document.getElementById("unitLocation").textContent = `Location: ${JSON.stringify(unit.position)}`;
  document.getElementById("moveUnitBtn").style.display = "inline-block";
  selectedUnit = unit;
}

function moveSelectedUnitToDestination(dest) {
  if (!selectedUnit || !dest) return;

  const { x: startX, y: startY } = selectedUnit.position;
  const { x: endX, y: endY } = dest;
  const dx = endX - startX;
  const dy = endY - startY;
  const totalDistance = Math.sqrt(dx * dx + dy * dy);

  const multiplier = isWater(dest) ? WATER_MULTIPLIER : isEnemyTerritory(dest) ? ENEMY_TERRITORY_MULTIPLIER : 1;
  const effectiveSpeed = BASE_SPEED * multiplier;
  const totalTravelTime = totalDistance / effectiveSpeed;

  let startTime = null;
  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = (timestamp - startTime) / 1000;
    let t = elapsed / totalTravelTime;
    if (t > 1) t = 1;

    const currentX = startX + t * dx;
    const currentY = startY + t * dy;
    selectedUnit.element.setAttribute("cx", currentX);
    selectedUnit.element.setAttribute("cy", currentY);
    selectedUnit.position = { x: currentX, y: currentY };
    document.getElementById("unitTravelTime").textContent = `Travel Time: ${(totalTravelTime - elapsed).toFixed(1)}s`;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      selectedUnit.isTraveling = false;
      selectedUnit.travelTime = 0;
      console.log("Unit reached destination");
    }
  }

  selectedUnit.isTraveling = true;
  selectedUnit.travelTime = totalTravelTime;
  requestAnimationFrame(animate);
}

function isWater(point) {
  return false;
}

function isEnemyTerritory(point) {
  return false;
}

function updatePlayerStats() {
  document.getElementById("playerUnits").textContent = `Units: ${units.length}`;
  document.getElementById("playerGold").textContent = "Gold: 1000";
  document.getElementById("playerSteel").textContent = "Steel: 500";
  document.getElementById("playerAmmo").textContent = "Ammo: 300";
}

function updateTime() {
  const now = new Date();
  const formatted = now.toLocaleTimeString();
  document.getElementById("currentTime").textContent = `Time: ${formatted}`;
}