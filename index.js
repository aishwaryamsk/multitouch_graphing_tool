let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let xScale; // scale for labels on x-axis -- reference scale
let unitXScale; // scale for unit vis on x-axis -- reference scale
let unitYScale; // scale for unit vis on y-axis
let xAxis;
let numRowElements;

let attribute = null;

let tooltipTriggerList;
let col_values;
let col_types;
let newColor = "#0067cd";

let tip;

let cols_lower, cols;
let all_shapes = [squareShape, triangleShape, circleShape, crossShape, diamondShape, starShape, wyeShape];

// actions for which undo/redo is defined
let undoActionsList = ['changeColor', 'changeShape', 'changeSize', 'filterData', 'default'];

/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape, atrribute that it's grouped with etc) for each data point
*/
let dataset = [];
let columns = [];

let isNumericScale = false;
let prevRadio = null;

// Holds the current data displayed in the chart
let currentData = [];
let allData = []; // holds all attributes
let curDataAttrs = {};

// Undo/Redo
let undoStack = [];
let redoStack = [];

// settings
let duration = 1;
let circleRadius = 7;
let unitRadius = 7;
let attrValuesCount; // keeps count of values in the grouped attribute
let sortedAxisLabels; // keeps sorted order of atrributes on x axis
const defSizeRatio = 9;
// selections
let selection = []; // all selected unit vis
let shapeNum = 7;


/* Multi-touch or multi-pointers */
// Preserving a pointer's event state during various event phases
// Event caches, one per touch target
let evCacheContent = [];
let evCacheXAxis = [];
let prevDiff = -1; // for pinch-zoom -- any direction
let zoomState;
let onePointerTappedTwice = false;
let twoPointersTappedTwice = false;

// user preferences
let useCustomIcons = false;
let iconSize = 2 * circleRadius; //default
let unitVisHtMargin = iconSize;
let unitVisPadding = 1.5;
let imgSVGs = [];
let attrSortOder = 0; // 0: ascending, 1: descending
let currSize = 20;
const numInitialShapes = 7;

let array = [d3.csv('dataset/candy-data.csv'), d3.xml('images/candy.svg')]
Promise.all(array).then(function (data1) {

    let imgSVG = data1[1];
    let svgNode = imgSVG.getElementsByTagName("svg")[0];
    d3.select(svgNode)
        .attr('height', 18)
        .attr('width', 18)
        .style('fill', 'brown');
    iconSize = 20;
    imgSVGs.push(svgNode);

    let data = data1;
    data[0].forEach(d => {
        for (let attr in d) {
            if (attr !== 'Candy')
                d[attr] = +d[attr];
        }
    });

    dataset = data[0];
    allData = setData(data[0]).slice();
    columns = data[0].columns;


    for (let i = 0; i < 7; i++) {
        d3.select("#shapes")
            .append("svg")
            .attr("width", "20")
            .attr("height", "20")
            .append("path")
            .attr("class", "pickShape")
            .style("cursor", "pointer")
            .attr("id", (d) => "shape-" + i)
            .attr("d", all_shapes[i])
            //.attr("d", i)
            .attr("fill", "#0067cd")
            .attr("transform", "translate(10, 10)")
            .on('pointerdown', function (e, d) {
                // console.log("att", e['target']['id']);
                //findShape(e['target']['id']);
                changeShape(e['target']['id'].slice(6));
            })
    }

    // console.log("imgSVG ", imgSVG, svgNode);

    lastShape = d3.select("#shapes")
        .append("xhtml:body")
        .attr("id", "shape-" + shapeNum)
        // .html(imgSVG['activeElement']['outerHTML'])
        .html(svgNode.outerHTML)
        .style("display", "inline");

    d3.selectAll("#shape-" + shapeNum + " svg")
        .attr("id", "shape-" + shapeNum);

    lastShape.on('pointerdown', function (e, d) {
        changeShape(e['target']['parentElement']['id'].slice(6));
    })

    d3.select("#shapes body svg")
        .style("fill", "#0067cd")

    // CHANGE LATER?: initially, use chocolate as an attribute to group on
    //attribute = 'fruity';
    //attribute = columns[11];
    attribute = columns[1];
    //attribute = columns[0];
    //attribute = 'sugarPercent';
    //attribute = 'winPercent';
    //attribute = 'pricePercent';
    setNumericScale();
    groupByAttribute(currentData, attribute);


    // Niv
    cols = Object.keys(allData[0].data);
    col_values = Object.values(allData[0].data)
    col_types = col_values.map((d) => typeof (d));

    overview(allData.length, cols.length);
    tabulate(allData, cols);
    createAccordion(allData, cols);
    createDropDown(allData, cols);



    //cols = Object.keys(currentData[0].data);
    //visualize(11); //groupByAttribute, create, update
    createVisualization();
    updateVisualization();

    document.querySelector("#colorPicker").onchange = e => {
        // console.log(e.target.value);
        changeColor(e.target.value);
    }

    document.querySelector("#pickSize").onchange = e => {
        // console.log(e.target.value);
        currSize = e.target.value;
        changeSize(e.target.value);
    }

    d3.select("#dropdownMenuButton1")
        .text(attribute);

    d3.selectAll("#dropdownMenuButton3,#dropdownMenuButton4,#dropdownMenuButton5,#dropdownMenuButton6,#dropdownMenuButton7")
        .text("None");

    d3.select('#x-axis-label')
        .text(attribute);

    tooltipTriggerList = [].slice.call(
        document.querySelectorAll('[data-toggle="tooltip"]')
    );

    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    d3.select("#selection")
        .append("xhtml:body")
        .attr("id", "selection-text")
        .html("<br>Lasso-select datapoints to view stats.<br>");

    // add state to undo stack
    undoStack.push({
        action: 'default',
        currentData: cloneObj(currentData),
        curDataAttrs: cloneObj(curDataAttrs),
        unitVisHtMargin: unitVisHtMargin,
        unitVisPadding: unitVisPadding
    });
});

function createVisualization() {
    // Initialize variables
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    unitXScale = d3.scaleLinear();
    unitYScale = d3.scaleLinear();


    //d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
    d3.select("svg#chart")
        .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])

    // create a rectangle region that allows for lasso selection  
    d3.select("#lasso-selectable-area rect")
        .attr('fill', 'transparent')
        .attr('width', width + margin.left + margin.right)
        .attr('height', margin.top + height);

    d3.select('#chart-content')
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    d3.select('#x-axis-content')
        .attr("transform", "translate(" + margin.left + "," + (margin.top + height) + ")");

    // create a rectangluar region that clips everything outside it -- this is to show chart content that is only inside this region on zoom 
    d3.select('svg#chart').append('defs')
        .append('clipPath')
        .attr('id', 'clipx')
        .append('rect')
        .attr('x', -10)
        .attr('y', 0)
        .attr('width', width + 20)
        .attr('height', height);


    // Enable Lasso selection for unit visualization -- for the svg and the units within it
    lasso.targetArea(d3.select('#lasso-selectable-area'))
        .items(d3.selectAll('#chart-content .unit'));
    d3.select("#chart").call(lasso).call(chartZoom);
}

function updateVisualization() {
    //unitVisPadding = 1.5; //pixelsd
    setNumericScale();

    // set the x scale based on type of data
    if (isNumericScale) { // numeric scale
        xScale = d3.scaleLinear();
        let minMax = d3.extent(currentData, function (d) {
            return d.data[attribute];
        });
        xScale.domain(minMax).range([0, width]); // takes number as input
    } else { // categorical scale (yes/no)
        xScale = d3.scaleBand();

        // determine order of columns
        if (attrSortOder == 0)
            sortedAxisLabels.sort((a, b) => a.attrName.localeCompare(b.attrName));
        else sortedAxisLabels.sort((a, b) => b.attrName.localeCompare(a.attrName));

        //xScale.domain(Object.keys(attrValuesCount)).range([0, width]).paddingInner(.7).paddingOuter(0.7); // takes string as input
        xScale.domain(sortedAxisLabels.map(d => d.attrValue)).range([0, width]).paddingInner(.7).paddingOuter(0.7); // takes string as input

        // set number of elements in each column
        // get max size in dataset


        numRowElements = Math.floor((xScale.bandwidth() - unitVisPadding) / ((2 * circleRadius) + unitVisPadding));
    }

    /* let the number of elements per row in each column be at least 1 */
    numRowElements = numRowElements > 1 ? numRowElements : 1;

    /* x-scale of the attributes */
    unitXScale.domain([0, numRowElements]);

    let maxAttributeValueCount = Math.max(...Object.values(attrValuesCount));
    //unitVisHtMargin = iconSize;

    let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
    //let yScaleHeight = 2 * unitSize * (maxAttributeValueCount / numRowElements) * unitVisPadding;
    unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)])
        .range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);


    // add x-axis
    xAxis = d3.axisBottom(xScale).tickSize(4);

    d3.select('.unit-vis')
        .attr('clip-path', 'url(#clipx)');

    d3.select('.x-axis')
        .call(xAxis)
        .style("font-size", "1em");

    if (sortedAxisLabels.length > 5) {
        d3.select('.x-axis')
            .selectAll('text')
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")
        if (sortedAxisLabels.length > 30) {
            d3.select('.x-axis')
                .style("font-size", "0.5em");
        }
    }

    let attrs = sortedAxisLabels.map(function (d, i) {
        return d.attrName;
    });

    if (!isNumericScale)
        d3.select('.x-axis')
            .selectAll("text")
            //.text((d, i) => xAxesLabels[i]);
            .text((d, i) => attrs[i]);

    // Update data in the visualization
    updateUnitViz();

    // Update x-axis label
    d3.select('#x-axis-label')
        .text(attribute)
        .attr("x", width / 2)
        .attr("y", margin.top + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "1.2em");

    defineLassoSelection();
}


function defineLassoSelection() {
    lasso.items(d3.selectAll('#chart-content .unit'));
}

function updateUnitViz(tx = 1, tk = 1, shapesData = [], SVGsData = []) {

    if (shapesData.length == 0 && SVGsData.length == 0) {
        for (let d of currentData) {
            if (curDataAttrs[d.id].shapeId < numInitialShapes)
                shapesData.push(d);
            else SVGsData.push(d);
        }
    }

    // update paths
    d3.selectAll("#chart-content .unit-vis")
        .selectAll('path.unit')
        .data(shapesData, d => d.id)
        .join("path")
        .attr("class", "unit")
        .attr("id", d => `unit-icon-${d.id}`)
        .attr('d', function (d) {
            return all_shapes[curDataAttrs[d.id].shapeId].size(curDataAttrs[d.id].size * defSizeRatio)();
            // if (pathShapeId !== -1)
            //     return all_shapes[pathShapeId].size(curDataAttrs[d.id].size * defSizeRatio)()
            // else return all_shapes[curDataAttrs[d.id].shapeId].size(curDataAttrs[d.id].size * defSizeRatio)();
        })
        .style('fill', d => curDataAttrs[d.id].color)
        .attr("data-toggle", "tooltip")
        .attr("data-placement", "top")
        .attr("title", d => d['data']['Candy'])
        .attr('transform', d => plotXY(d, tx, tk));


    // update gs
    d3.selectAll("#chart-content .unit-vis")
        .selectAll('g.unit')
        .data(SVGsData, function (d) {
            return d.id
        }).join("g") //image
        .attr("class", "unit")
        .attr("id", d => `unit-icon-${d.id}`)
        .attr("data-toggle", "tooltip")
        .attr("data-placement", "top")
        .attr("title", d => d['data']['Candy'])
        .attr('transform', d => `${plotXY(d, tx, tk)} translate(-10, -10)`);

    // adds svgs to gs -- while adding back old svgs on filter, it retains the properties of the unit vises
    // note: this only appends svgs to newly created gs. This won't update an svg.
    let newgs = d3.selectAll("g.unit:not([svg])");
    for (let d of newgs) {
        let id = d.getAttribute('id').split('-').at(-1);
        // remove svg from g id, and append new svg
        if (d3.select(`g.unit#unit-icon-${id} svg`).empty()) {
            let s = imgSVGs[curDataAttrs[id].shapeId - numInitialShapes];
            // clones whole subtree -- has to be cloned for each instance of the candy
            d3.select(s).attr('id', `unit-${id}`)
                .attr('class', 'custom-icon')
                .style('fill', curDataAttrs[id].color)
                .attr('height', curDataAttrs[id].size)
                .attr('width', curDataAttrs[id].size);
            d3.select(`g.unit#unit-icon-${id}`).node().append(s.cloneNode(true));
        }
    }
    d3.selectAll(".unit svg rect").attr("fill", "none");
    defineLassoSelection();
}

function plotXY(d, tx = 1, tk = 1) {
    let x, y;
    if (attribute != null) {
        let order = curDataAttrs[d.id]['groupBy'].order;
        if (!isNumericScale) {
            // update the range of x-scale for unit vis to the x value of the column
            bandwidth = xScale.bandwidth() * 2;
            unitXScale.range([xScale(String(d.data[attribute])),
            xScale(String(d.data[attribute])) + bandwidth]);
            x = unitXScale((order - 1) % numRowElements);
        } else {
            x = xScale(d.data[attribute]); // numeric scale
        }
        y = unitYScale(Math.floor((order - 1) / numRowElements));
    }
    return `translate(${tx + (x * tk)}, ${y})`;
}

/* Helper functions */

function cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj))
}

/* Read SVG */
function readFile(e) {
    let file = document.querySelector('input[type=file]').files[0];
    let reader = new FileReader();
    reader.onload = (e) => {
        importImgSVG(e.target.result);
    }
    reader.readAsText(file);
}

function importImgSVG(data) {
    let parser = new DOMParser();
    let imgSVG = parser.parseFromString(data, "image/svg+xml");
    let svgNode = imgSVG.getElementsByTagName("svg")[0];

    d3.select(svgNode)
        .attr('height', 18)
        .attr('width', 18);
    imgSVGs.push(svgNode);

    shapeNum += 1;
    if (svgNode) {
        lastShape = d3.select("#shapes")
            .append("xhtml:body")
            .attr("id", "shape-" + shapeNum)
            .html(svgNode.outerHTML)
            .style("display", "inline");

        d3.selectAll("#shape-" + shapeNum + " svg")
            .attr("id", "shape-" + shapeNum);

        lastShape.on('pointerdown', function (e, d) {
            changeShape(e['target']['parentElement']['id'].slice(6));
        })

        d3.select("#shapes body svg")
            .style("fill", newColor);
    }
}

function filterData(attr, lowValue, highValue) {
    // remove the selcted elements from current data
    //selection
    // between a range (including)
    currentData = [];
    for (let d of allData) {
        if (d.data[attr] >= lowValue && d.data[attr] <= highValue) {
            currentData.push(d);
        }
    }

    //d3.selectAll(".unit").remove();
    groupByAttribute(currentData, attribute);
    updateVisualization();
    undoStack.push({
        action: 'filterData',
        currentData: cloneObj(currentData),
        curDataAttrs: cloneObj(curDataAttrs),
        unitVisHtMargin: unitVisHtMargin,
        unitVisPadding: unitVisPadding
    });
}

function updateXAttribute(attr) {
    attribute = attr;
    groupByAttribute(currentData, attribute);
    updateVisualization();
    // restore zoomed state
    if (zoomState !== undefined)
        zoomed(zoomState);
}

function clearData() {
    // filter this
}

/* Allow users to filter by only 1 attribute at a time? */
function groupByAttribute(data, attribute) {
    // find unique attribute values
    let attrValues = [];
    for (let dataPt of data) {
        if (!attrValues.includes(dataPt.data[attribute])) {
            attrValues.push(dataPt.data[attribute]);
        }
    }
    attrValues.sort();

    // initialize counter to zero for attribute value
    attrValuesCount = {};
    for (let attr_value of attrValues) {
        attrValuesCount[attr_value] = 0;
    }

    // Hard-coded for candy dataset --> eg: 0 for no chocolate, 1 for chocolate
    let xAxesLabels = [];
    if (!isNumericScale) {
        if (Object.keys(attrValuesCount).length === 2) {
            xAxesLabels[0] = `No ${attribute}`;
            xAxesLabels[1] = `${attribute}`;
        } else {
            xAxesLabels = attrValues;
        }
    }

    sortedAxisLabels = [];
    if (!isNumericScale) {
        let attrVals = Object.keys(attrValuesCount);
        for (let i = 0; i < attrVals.length; i++) {
            sortedAxisLabels.push({ attrName: xAxesLabels[i], attrValue: attrVals[i] });
        }
    }

    // keep count of element's occurrence in each attribute value and store for grouping
    for (let dataPt of data) {
        attrValuesCount[dataPt.data[attribute]]++;
        curDataAttrs[dataPt.id]['groupBy'] = {
            'order': attrValuesCount[dataPt.data[attribute]]
        };
    }

    return data;
}

// called once on load
function setData(d) {
    let i = 0;
    curDataAttrs = {};
    currentData = [];
    for (let dataPt of d) {
        //dataset.push({ id: i, data: dataPt, attrs: { color: '#0067cd', shape: circleShape(), imgSvgId: 0 } });
        //dataset.push({ id: i, data: dataPt });
        currentData.push({ id: i, data: dataPt });
        curDataAttrs[i] = { color: '#0067cd', shapeId: 2, size: 20 };
        i++;
    }
    return currentData;
}

/* function candyRow(d) {
    return {
        candy: d['Candy'],
        chocolate: +d.Chocolate,
        fruity: +d.Fruity,
        caramel: +d.Caramel,
        peanutyAlmondy: +d['Peanuty-Almondy'],
        nougat: +d.Nougat,
        crispedRiceWafer: +d['Crisped Rice Wafer'],
        hardCandy: +d['Hard Candy'],
        barCandy: +d['Bar'],
        pluribusCandy: +d['Pluribus Candy'],
        sugarPercent: +d['Sugar Percent'],
        pricePercent: +d['Price Percent'],
        winPercent: +d['Win Percent'],
    };
}; */

/* 
* Register events handlers for pointers (touch, pen, mouse, etc) 
* Events: pointerdown, pointermove, pointerup (pointercancel, pointerout, pointerleave)
* Source: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction
*/
function setHandlers(name) {
    // Install event handlers for the given element
    const el = document.getElementById(name);
    el.onpointerdown = pointerdownHandler;

    // Use same handler for pointer{up,cancel,out,leave} events since
    // the semantics for these events - in this app - are the same.
    el.onpointerup = pointerupHandler;
    el.onpointercancel = pointerupHandler;
    //el.onpointerout = pointerupHandler; // moving to descendent (unit circles) triggers pointerout 
    el.onpointerleave = pointerupHandler;

    el.onpointermove = twoFingerSwipe;

    // move handlers for different targets
    /* if (name === 'lasso-selectable-area')
        el.onpointermove = pinchZoomXY;
    else if (name === 'x-axis-content')
        el.onpointermove = pinchZoomX; */
}

function init() {
    setHandlers("lasso-selectable-area");
    setHandlers("x-axis-content");
}

function pointerdownHandler(ev) {
    /* pointers can be: finger(s) - touch, pen, etc.
    * mouse hover won't be a pointerdown
    * mouse click counts as a pointerdown
    * */
    ev.preventDefault();
    //evCache.push(ev);
    pushEvent(ev);
    //updateBackground(ev);
    // check if this is a double tap
    doubleTapHandler(ev);
    // swipe left/right handler
    startTwoFingerSwipe(ev);
}

function doubleTapHandler(ev) {
    /* pointers can be: finger(s) - touch, pen, etc.
    * mouse hover won't be a pointerdown
    * mouse click counts as a pointerdown
    * */
    // detect pointer double taps on chart region
    detectOnePointerDoubleTap();
    detectTwoPointersDoubleTap();
    detectMultiplePointersOnScreen();
}

function detectOnePointerDoubleTap() {

    // within 300 milli seconds of a single tap and it was not a double tap previously
    if (!onePointerTappedTwice && evCacheContent.length === 1 && !twoPointersTappedTwice) {
        onePointerTappedTwice = true;
        setTimeout(function () { onePointerTappedTwice = false; }, 300);
        return false;
    }
    // action to do on double tap
    if (onePointerTappedTwice && evCacheContent.length === 1 && !twoPointersTappedTwice) {

        console.log('1 pointer double tap');
        console.log(selection);

        // reset value for next double tap
        onePointerTappedTwice = false;
    }
}

function detectTwoPointersDoubleTap() {
    //console.log(evCacheContent)
    if (!twoPointersTappedTwice && evCacheContent.length === 2) {
        twoPointersTappedTwice = true;
        setTimeout(function () { twoPointersTappedTwice = false; }, 300);
        return false;
    }
    // action to do on double tap
    if (twoPointersTappedTwice && evCacheContent.length === 2) {
        resetZoom();

        console.log('two pointer double tap');

        // reset value for next double tap
        twoPointersTappedTwice = false;
    }
}

// indicates whether there was multiples pointers on screen in the last 200 ms
var multiplePtrsInLast400ms = false;

function detectMultiplePointersOnScreen() {
    // lasso will be behind by 400ms in case user uses a multiple pointer gesture followed by lasso selection within 400ms
    if (!multiplePtrsInLast400ms && evCacheContent.length > 1) {
        multiplePtrsInLast400ms = true; // this value holds only for 400 ms
        setTimeout(function () { multiplePtrsInLast400ms = false; }, 400);
        return false;
    }
}

/* function pinchZoomXY(ev) {
    ev.preventDefault();
    pinchZoom(ev, 'xy')
    //updateBackground(ev);
}

function pinchZoomX(ev) {
    ev.preventDefault();
    pinchZoom(ev, 'x')
    //updateBackground(ev);
} */

let chartZoom = d3.zoom()
    .on('zoom', zoomed);

function zoomed(e) {
    if (e) {
        let t = e.transform;
        let gXAxis = d3.select('.x-axis');

        if (isNumericScale) {
            // numeric scale
            // create new scale oject based on event
            var new_xScale = t.rescaleX(xScale);
            // update axes
            gXAxis.call(xAxis.scale(new_xScale));
        } else {
            // categorical scale
            // transform x-axis g tag
            gXAxis.attr("transform", d3.zoomIdentity.translate(t.x, 0).scale(t.k))
                .attr('stroke-width', '0.05em');

            if (sortedAxisLabels.length > 5) {
                gXAxis.selectAll('text')
                    .attr("transform", `${d3.zoomIdentity.scale(1 / t.k)} rotate(-45)`)
                    .style("text-anchor", "end")
                if (sortedAxisLabels.length > 30) {
                    gXAxis
                        .style("font-size", "0.5em");
                }
            } else {
                // transform texts
                gXAxis.selectAll("text")
                    .attr("transform", `${d3.zoomIdentity.scale(1 / t.k)} `);
            }
        }
        // transform circles along x-axis only
        updateUnitViz(t.x, t.k);
    }
};

function resetZoom() {
    let chart = d3.select("#chart");
    chart.transition().duration(750).call(
        chartZoom.transform,
        d3.zoomIdentity,
        d3.zoomTransform(chart.node()).invert([width / 2, height / 2])
    );
}

function setNumericScale() {
    if (['Win Percent', 'Sugar Percent', 'Price Percent'].includes(attribute))
        isNumericScale = true;
    else isNumericScale = false;
}

var prevPotrLoc = undefined; // pointer 0
function startTwoFingerSwipe(ev) {
    if (evCacheContent.length === 2 && prevPotrLoc === undefined) {
        const evCache = getCache(ev);
        const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
        evCache[index] = ev;
        prevPotrLoc = [{ x: evCache[0].clientX, y: evCache[0].clientY }, { x: evCache[1].clientX, y: evCache[1].clientY }];
    } else twoFingerSwipe();
}

function twoFingerSwipe(ev) {
    const evCache = getCache(ev);
    if (ev !== undefined && evCache && evCache.length === 2) {
        const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
        evCache[index] = ev;

        // If two pointers are down and the distance between each pointer move is positive/negative along an axis, determine swipe direction
        // Calculate the distance between the previous pointer location and current
        if (prevPotrLoc === undefined) {
            return;
        }
        var x = ev.clientX;
        var y = ev.clientY;
        console.log(prevPotrLoc)
        var xDiff = prevPotrLoc[index].x - x;
        var yDiff = prevPotrLoc[index].y - y;

        if (Math.abs(xDiff) > Math.abs(yDiff)) {
            if (xDiff > 0) {
                /* right swipe: undo */
                console.log('swipe left')
                redoAction();
            } else if (xDiff < 0) {
                /* left swipe: redo */
                console.log('swipe right');
                undoAction();
            }
        }
        /* reset values */
        prevPotrLoc = undefined;
    }
}

/*
function pinchZoom(ev, direction) {
    // This function implements a 2-pointer horizontal pinch/zoom gesture.
    //
    // If the distance between the two pointers has increased (zoom in),
    // the target element's background is changed to "pink" and if the
    // distance is decreasing (zoom out), the color is changed to "lightblue".
    //
    // This function sets the target element's border to "dashed" to visually
    // indicate the pointer's target received a move event.

    // Find this event in the cache and update its record with this event
    const evCache = getCache(ev);
    if (evCache && evCache.length === 2) {
        const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
        evCache[index] = ev;

        // If two pointers are down, check for pinch gestures
        // Calculate the distance between the two pointers
        let curDiff = -1;
        if (direction === 'xy') {
            const x = evCache[1].clientX - evCache[0].clientX;
            const y = evCache[1].clientY - evCache[0].clientY;
            curDiff = Math.sqrt(x * x + y * y);
        } else curDiff = evCache[1].clientX - evCache[0].clientX;
        //console.log('curDiff: ', curDiff);
        if (prevDiff > 0) {
            if (curDiff > prevDiff) {
                // The distance between the two pointers has increased
                //console.log("Pinch moving OUT -> Zoom in", ev);
                ev.target.style.fill = "darkkhaki";
            }
            if (curDiff < prevDiff) {
                // The distance between the two pointers has decreased
                //console.log("Pinch moving IN -> Zoom out", ev);
                ev.target.style.fill = "aqua";
            }
        }

        // Cache the distance for the next move event
        prevDiff = curDiff;
    }
}
*/

function pointerupHandler(ev) {
    ev.preventDefault();
    // Remove this touch point from the cache and reset the target's
    // background and border
    let removedId = removeEvent(ev); // return the DOM element for which the removed event was a target of
    //updateBackground(ev);

    // If the number of pointers down is less than two then reset diff tracker
    if (removedId === 'content' && evCacheContent.length < 2) {
        prevDiff = -1;
    }
    detectMultiplePointersOnScreen();
}

function getCache(ev) {
    // Return the cache for this event's target element
    //console.log($('#x-axis-content').has(ev.target).length);
    //if ($('#evCacheXAxis').has(ev.target).length)
    // if ($('#evCacheXAxis').has(ev.target).length)
    //     return evCacheXAxis;
    // else return evCacheContent;
    return evCacheContent;
}

function pushEvent(ev) {
    // Save this event in the target's cache
    const evCache = getCache(ev);
    evCache.push(ev);
}

function removeEvent(ev) {
    // Remove this event from the target's cache
    const evCache = getCache(ev);
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);
    //evCache.splice(index, 1);
    if (index > -1)
        evCache.splice(index, 1);
    return getCache(ev);
}


/* function removeEvent(ev) {
    // Remove this event from the target's cache
    const evCache = getCache(ev);
    const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId);

    if (index > -1)
        evCache.splice(index, 1);
} */



/* Lasso functions */
let lasso = d3.lasso()
    .closePathDistance(500)
    .closePathSelect(true)
    .on("start", lassoStart)
    .on("draw", lassoDraw)
    .on("end", function () {
        lassoEnd();

        //         changeTab();
        //console.log('selectedItems', lasso.selectedItems());
    });

function lassoStart() {
    lasso.items()
        //.attr('r', circleRadius) // reset radius
        .classed("not_possible", true)
        .classed("selected", false);
};

function lassoDraw() {
    lasso.possibleItems()
        .classed("not_possible", false)
        .classed("possible", true)
    //.attr('r', circleRadius);
    lasso.notPossibleItems()
        .classed("not_possible", true)
        .classed("possible", false)
    //.attr('r', circleRadius / 2); // decrease radius of not possible points
};

function lassoEnd() {
    lasso.items()
        .classed("not_possible", false)
        .classed("possible", false);

    // if nothing is selected, keep element radius as unchanged
    if (lasso.selectedItems().size() === 0) {
        lasso.notSelectedItems()
            .classed("selected", false)
        //.attr('r', circleRadius); // reset radius of unselected points
    }

    selection = lasso.selectedItems();

    /* the radius of possible points (which becomes selected now) will remain as 'circleRadius'.
    So, only update the radius of unselected points. */
    lasso.selectedItems()
        .classed("selected", true);
    lasso.notSelectedItems()
        .classed("selected", false)
    //.attr('r', circleRadius); // reset radius of unselected points

    updateSelection();

};

function deselectPoints() {
    lasso.selectedItems()
        .classed("selected", false);
}

function undoAction() {
    if (undoStack.length > 1) {
        console.log('undoStack', undoStack)
        let curAction = undoStack.pop();
        redoStack.push(curAction);

        //let prevAction = undoStack.pop();
        // current displayed state is the last item on undo stack
        let prevAction = undoStack.at(-1);
        //undoStack.push({action: 'default', currentData: [...currentData], curDataAttrs: {...curDataAttrs}});
        //undoStack.push({action: 'changeColor', function: changeColor, attrs: {newColor: newColor}, currentData: currentData, curDataAttrs: curDataAttrs});
        if (['changeColor', 'changeShape', 'changeSize', 'filterData', 'default'].includes(prevAction.action)) {
            currentData = cloneObj(prevAction.currentData);
            curDataAttrs = cloneObj(prevAction.curDataAttrs);
            unitVisHtMargin = prevAction.unitVisHtMargin;
            unitVisPadding = prevAction.unitVisPadding;
            updateVisualization();
        }
        // switch (prevAction.action) {
        //     case 'changeColor':
        //     case 'changeShape':
        //         currentData = cloneObj(prevAction.currentData);
        //         curDataAttrs = cloneObj(prevAction.curDataAttrs);
        //         updateUnitViz();
        //         break;
        //     case 'changeSize':
        //         currentData = cloneObj(prevAction.currentData);
        //         curDataAttrs = cloneObj(prevAction.curDataAttrs);
        //         unitVisHtMargin = prevAction.unitVisHtMargin;
        //         unitVisPadding = prevAction.unitVisPadding;
        //         updateVisualization();
        //         break;
        //     case 'filterData':
        //         currentData = cloneObj(prevAction.currentData);
        //         curDataAttrs = cloneObj(prevAction.curDataAttrs);
        //         updateUnitViz();
        //         break;
        //     default:
        //         // default state (first state of app)
        //         currentData = cloneObj(prevAction.currentData);
        //         curDataAttrs = cloneObj(prevAction.curDataAttrs);
        //         updateVisualization();
        // }
    }
}

function redoAction() {
    if (redoStack.length >= 1) {
        console.log('redoStack', redoStack)
        let curAction = redoStack.pop();
        undoStack.push(curAction);
        if (['changeColor', 'changeShape', 'changeSize', 'filterData', 'default'].includes(curAction.action)) {
            currentData = cloneObj(curAction.currentData);
            curDataAttrs = cloneObj(curAction.curDataAttrs);
            unitVisHtMargin = curAction.unitVisHtMargin;
            unitVisPadding = curAction.unitVisPadding;
            updateVisualization();
        }
        // switch (curAction.action) {
        //     case 'changeColor':
        //         currentData = cloneObj(curAction.currentData);
        //         curDataAttrs = cloneObj(curAction.curDataAttrs);
        //         updateUnitViz();
        //         break;
        //     case 'changeShape':
        //         currentData = cloneObj(curAction.currentData);
        //         curDataAttrs = cloneObj(curAction.curDataAttrs);
        //         updateUnitViz();
        //         break;
        //     case 'changeSize':
        //         currentData = cloneObj(curAction.currentData);
        //         curDataAttrs = cloneObj(curAction.curDataAttrs);
        //         updateUnitViz();
        //     case 'filterData':
        //         currentData = cloneObj(curAction.currentData);
        //         curDataAttrs = cloneObj(curAction.curDataAttrs);
        //         updateUnitViz();
        //         break;
        //     default:
        //         // default state (first state of app)
        //         currentData = cloneObj(curAction.currentData);
        //         curDataAttrs = cloneObj(curAction.curDataAttrs);
        //         updateVisualization();
        // }
    }
}


/* Niveditha */
function tabulate(data, cols) {
    var table = d3.select("#thetablebody").append("table").attr("class", "table table-striped");
    var head = table.append("thead")
    var body = table.append("tbody")

    head.append("tr")
        .selectAll("th")
        .data(cols)
        .enter()
        .append("th")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))

    var tr = body.selectAll("tr")
        .data(data)
        .enter()
        .append("tr")

    tr.selectAll("td")
        .data((d) => Object.values(d['data']))
        .enter()
        .append("td")
        .text((d) => d) //[0].toUpperCase() + d.slice(1));
}

function createAccordion(data, cols) {
    // var acc = d3.select("#pill-overview")
    //             .append("div")
    //             .attr("class", "accordion")
    //             .attr("id", "dim");

    var accitem = d3.select("#dim")
        .selectAll("div")
        .data(cols)
        .enter()
        .append("div")
        .attr("class", "accordion-item");

    accitem.append("h2")
        .attr("class", "accordion-header")
        .attr("id", (d, i) => "acc-heading-" + i)
        .append("button")
        .attr("class", "accordion-button collapsed")
        .attr("type", "button")
        .attr("data-bs-toggle", "collapse")
        .attr("data-bs-target", (d, i) => "#acc-" + i)
        .attr("aria-controls", (d, i) => "acc-" + i)
        .attr("aria-expanded", "false")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))

    accitem.append("div")
        .attr("class", "accordion-collapse collapse")
        .attr("id", (d, i) => "acc-" + i)
        .attr("aria-labelledby", (d, i) => "acc-heading-" + i)
        .attr("data-bs-parent", (d) => "#dim")
        .append("div")
        .attr("class", "accordion-body")
        .append("xhtml:body")
        .html((d) => stats(data, d));

}

function createDropDown(data, cols) {

    d3.select("#dropdown-menu1")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        .attr("class", "dropdown-item")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function (e, d) {

            let index = columns.indexOf(d);
            console.log("att", d, index);
            attribute = d;
            changeXAxis(index);

            if (d == "Candy" || Object.keys(attrValuesCount).length === 2) {
                d3.selectAll(".form-check").style("display", "block");
            } else {
                d3.selectAll(".form-check").style("display", "none");
            }

        });

    d3.select("#dropdown-menu3")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        .attr("class", "dropdown-item")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function (e, d) {
            console.log("att", d);
        });

    d3.select("#dropdown-menu4")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        // .attr("class", "dropdown-item")
        .attr("class", (d, i) => { if (col_types[i] != "string") { return "dropdown-item disabled"; } else { return "dropdown-item" } })
        .attr("tabindex", (d, i) => { if (col_types[i] != "string") { return "-1"; } })
        .attr("aria-disabled", (d, i) => { if (col_types[i] != "string") { return "true"; } })
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function (e, d) {
            console.log("att", d);
        });

    d3.select("#dropdown-menu5")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        // .attr("class", "dropdown-item")
        .attr("class", (d, i) => { if (col_types[i] == "string") { return "dropdown-item disabled"; } else { return "dropdown-item" } })
        .attr("tabindex", (d, i) => { if (col_types[i] == "string") { return "-1"; } })
        .attr("aria-disabled", (d, i) => { if (col_types[i] == "string") { return "true"; } })
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function (e, d) {
            console.log("att", d);
            getColforSize(d);
        });

    d3.select("#dropdown-menu7")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        // .attr("class", "dropdown-item")
        .attr("class", (d, i) => { if (col_types[i] == "string") { return "dropdown-item disabled"; } else { return "dropdown-item" } })
        .attr("tabindex", (d, i) => { if (col_types[i] == "string") { return "-1"; } })
        .attr("aria-disabled", (d, i) => { if (col_types[i] == "string") { return "true"; } })
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function (e, d) {
            console.log("filter", d);
            filterAxis(d);
        });

}

function stats(data, colname) {

    // if(typeof(list_items[0]) == "string")
    if (typeof (data[0]['data'][colname]) != "number") {

        let list_items = data.map((d) => d['data'][colname])
        return "Number of items: " + list_items.length;

    } else {

        // console.log("Column: ", colname, data[0]['data'][colname]);
        let total = 0;
        let count = 0;
        let max = data[0]['data'][colname];
        let min = data[0]['data'][colname];
        let quant = "";

        let currval;

        for (let i = 0; i < data.length; i++) {
            currval = data[i]['data'][colname];
            total += currval;
            count++;

            if (currval > max) {
                max = currval;
            }
            if (currval < min) {
                min = currval;
            }
        }
        quant += "Total: ";
        quant += Math.round(total * 100) / 100;
        quant += "<br>Average: ";
        quant += Math.round(total / count * 100) / 100;
        quant += "<br>Min: ";
        quant += Math.round(min * 100) / 100;
        quant += "<br>Max: ";
        quant += Math.round(max * 100) / 100;

        // console.log(quant);

        return quant;
    }
}

function overview(rows, columns) {
    d3.select("#overview_num").text("The dataset has " + rows + " rows and " + columns + " columns.");
    d3.select("#overview").text("Data attributes");
}

function getColforSize(colname) {

    //let list_items = dataset.map((d) => d['data'][colname])
    let list_items = allData.map((d) => d['data'][colname])

    let max = list_items[0];
    let min = list_items[0];
    list_items.forEach(element => {
        if (element > max) {
            max = element;
        }
        if (element < min) {
            min = element;
        }
    });
    console.log("Range", min, max);
    changeSizeByCol(colname, min, max);
}

function changeSizeByCol(colname, min, max) {
    // console.log("data", currentData);

    d3.select("#dropdownMenuButton5")
        .text(colname);

    //for (let i = 0; i < currentData.length; i++) {
    for (let d of currentData) {
        //let name = "#unit-icon-" + i + " svg";
        let name = "#unit-icon-" + d.id + " svg";
        //let currsize = currentData[i]['data'][colname];
        let currsize = d.data[colname];
        let reqsize = (((currsize - min) * (40 - 10)) / (max - min)) + 10;

        //console.log("curr", reqsize);
        d3.select(name).attr('width', reqsize).attr('height', reqsize);
    }
}

function changeColor(newColor) {
    // lasso selection can be [], or 0 selections as an object
    if (selection.length !== 0 && selection.data().length !== 0)
        updateColors(selection, newColor);
    // applied to all data points
    else updateColors(d3.selectAll('.unit'), newColor);
    d3.selectAll("#shapes svg path").style('fill', newColor);

    // add action to undoStack
    undoStack.push({
        action: 'changeColor',
        currentData: cloneObj(currentData),
        curDataAttrs: cloneObj(curDataAttrs),
        unitVisHtMargin: unitVisHtMargin,
        unitVisPadding: unitVisPadding
    });
}

function updateColors(selection, newColor) {
    for (let elm of selection) {
        let id = d3.select(elm).attr('id').split('-').at(-1);
        if (!d3.select(`#unit-icon-${id}`).select('svg').empty())
            d3.select(`#unit-icon-${id}`).select('svg').style('fill', newColor);
        else d3.select(`#unit-icon-${id}`).style('fill', newColor);
        curDataAttrs[id].color = newColor;
    }

}

function changeSize(newSize) {
    // lasso selected points
    if (selection.length !== 0 && selection.data().length !== 0)
        updateSize(selection, newSize);
    // all points
    else {
        updateSize(d3.selectAll('.unit'), newSize);
        unitVisHtMargin = newSize;
        unitVisPadding = newSize / 15;
        updateVisualization();
    }
    // store action in undo stack
    undoStack.push({
        action: 'changeSize',
        currentData: cloneObj(currentData),
        curDataAttrs: cloneObj(curDataAttrs),
        unitVisHtMargin: unitVisHtMargin,
        unitVisPadding: unitVisPadding
    });
}

function updateSize(selection, newSize) {
    for (let elm of selection) {
        let id = d3.select(elm).attr('id').split('-').at(-1);
        if (!d3.select(`#unit-icon-${id}`).select('svg').empty())
            d3.select(`#unit-icon-${id}`).select('svg').attr('height', newSize).attr('width', newSize)
        //.attr('transform', 'translate(-10, -10)');
        else d3.select(`#unit-icon-${id}`).attr('d', all_shapes[curDataAttrs[id].shapeId].size(newSize * defSizeRatio)());
        curDataAttrs[id].size = newSize;
    }
}

function changeShape(shapeId) {
    shapeId = parseInt(shapeId);

    let shapesData = [];
    let SVGsData = [];

    // change lasso selected points
    if (selection.length !== 0 && selection.data().length !== 0) {
        // get data from non selected points
        let ids = selection.data().map(d => d.id);
        for (let d of currentData) {
            if (!ids.includes(d.id)) {
                if (d3.select(`#unit-icon-${d.id}`).node().tagName == 'path')
                    shapesData.push(currentData[d.id]);
                else SVGsData.push(currentData[d.id]);
            }
        }

        // changing to custom shape
        if (shapeId < numInitialShapes) {
            // get all data inside lasso selection
            for (let d of selection) {
                let id = d.getAttribute('id').split('-').at(-1);
                shapesData.push(currentData[id]);
                curDataAttrs[id].shapeId = shapeId; // all elements inside lasso changes to this shape
            }

            // remove unwanted gs and adds new paths
            updateUnitViz(undefined, undefined, shapesData, SVGsData);

            // update paths to new shapes
            for (let d of selection) {
                let id = d.getAttribute('id').split('-').at(-1);
                d3.select(`path.unit #unit-icon-${id}`)
                    //.attr("d", d => all_shapes[shapeId]())
                    .attr("d", d => all_shapes[shapeId].size(curDataAttrs[d.id].size * defSizeRatio)())
                    .attr('id', `unit-icon-${id}`)
                    .attr("class", "unit")
                    .attr('fill', curDataAttrs[id].color)
                    .attr('height', curDataAttrs[id].size)
                    .attr('width', curDataAttrs[id].size)
                    .attr('transform', d => `${plotXY(d)}`);
            }
        } // changing to custom svg
        else {
            // get data for update paths
            // non selected points
            for (let d of selection) {
                let id = d.getAttribute('id').split('-').at(-1);
                SVGsData.push(currentData[id]);
                curDataAttrs[id].shapeId = shapeId;
            }

            // remove unwanted paths and add gs
            updateUnitViz(undefined, undefined, shapesData, SVGsData);

            // update previous svgs to svgs
            let s = imgSVGs[shapeId - numInitialShapes];
            for (let d of selection) {
                let id = d.getAttribute('id').split('-').at(-1);
                // changing from an svg to a different svg
                // remove svg from g id, and append new svg
                //if ((d3.select(`#unit-icon-${id} svg`)))
                d3.select(`g.unit#unit-icon-${id} svg`).remove();
                // clones whole subtree -- has to be cloned for each instance of the candy
                d3.select(s).attr('id', `unit-${id}`)
                    .attr('class', 'custom-icon')
                    .style('fill', curDataAttrs[id].color)
                    .attr('height', curDataAttrs[id].size)
                    .attr('width', curDataAttrs[id].size);
                d3.select(`g.unit#unit-icon-${id}`).node().append(s.cloneNode(true));
            }
            d3.selectAll(".unit svg rect").attr("fill", "none");
        }
    }
    // all points
    else {
        //change all paths to new shape/svg
        if (shapeId < numInitialShapes) {
            // change shapeIds of paths to shapeId
            for (let d of currentData)
                curDataAttrs[d.id].shapeId = shapeId;

            //remove all g.svgs and update paths
            updateUnitViz(undefined, undefined, currentData, []);
        }
        // change to svg icons
        else {
            // change shapeIds of svgs to shapeId
            for (let d of currentData)
                curDataAttrs[d.id].shapeId = shapeId;

            //remove all paths
            updateUnitViz(undefined, undefined, [], currentData);

            //change all svgs to new svg
            let s = imgSVGs[shapeId - numInitialShapes];
            for (let d of selection) {
                let id = d.getAttribute('id').split('-').at(-1);
                // changing from an svg to a different svg
                // remove svg from g id, and append new svg
                //if ((d3.select(`#unit-icon-${id} svg`)))
                d3.select(`g.unit#unit-icon-${id} svg`).remove();
                // clones whole subtree -- has to be cloned for each instance of the candy
                d3.select(s).attr('id', `unit-${id}`).attr('class', 'custom-icon').style('fill', curDataAttrs[id].color);
                d3.select(`g.unit#unit-icon-${id}`).node().append(s.cloneNode(true));
                curDataAttrs[id].shapeId = shapeId;
            }
            d3.selectAll(".unit svg rect").attr("fill", "none");
        }
    }
    // restore zoomed state
    if (zoomState !== undefined) zoomed(zoomState);

    undoStack.push({
        action: 'changeShape',
        currentData: cloneObj(currentData),
        curDataAttrs: cloneObj(curDataAttrs),
        unitVisHtMargin: unitVisHtMargin,
        unitVisPadding: unitVisPadding
    });
}

function updateShapes2(selection, shape, shapeId) {
    for (let elm of selection) {
        let id = d3.select(elm).attr('id').split('-').at(-1);
        let dataPt;
        for (let d of Object.values(currentData)) {
            if (d.id == id) {
                dataPt = d;
                break;
            }
        };
        let units = d3.selectAll('.unit-vis');
        if (shapeId < numInitialShapes) {
            //d3.select(`#unit-icon-${id}`).classed("selected", false);
            // d3.select(`#unit-icon-${id}`).remove();
            // units.append('path')
            //     .attr('d', shape.size(currentFtrs.size * 6)())
            //     .attr('id', `unit-icon-${id}`)
            //     .attr("class", "unit")
            //     .attr('fill', curDataAttrs[id].color)
            //     .attr('transform', `${plotXY(dataPt)}`);

            d3.select(`#unit-icon-${id} path`)
                .attr('d', "disable")
                .attr('fill', "disable")
                .attr('transform', "disable");

            d3.select(`#unit-icon-${id} path`)
                .attr('d', all_shapes[shapeId])
                .attr('fill', curDataAttrs[id].color)
                .attr('transform', `${plotXY(dataPt)}`);

            //             d3.select(`#unit-icon-${id}`)
            //                 .attr('d', "disable")
            //                 .attr('fill', "disable")
            //                 .attr('transform', "disable");

            //             d3.select(`#unit-icon-${id}`)
            //                 .attr('d', all_shapes[shapeId])
            //                 .attr('fill', curDataAttrs[id].color)
            //                 .attr('transform', `${plotXY(dataPt)}`);

            curDataAttrs[id].shapeId = shapeId;
        } else {
            //d3.select(`#unit-icon-${id}`).classed("selected", false);
            // d3.select(`#unit-icon-${id}`).remove();

            d3.select(`#unit-icon-${id} g`).remove();
            d3.select(`#unit-icon-${id} path`).remove();
            let s = imgSVGs[shapeId - numInitialShapes];

            d3.select(s).attr('id', `unit-${id}`).style('fill', curDataAttrs[id].color);
            // let g = units
            //     .append('g')
            //     .attr("class", "unit")
            //     .attr("data-toggle", "tooltip")
            //     .attr("data-placement", "top")
            //     .attr("title", dataPt.data['Candy'])
            //     .attr("id", `unit-icon-${id}`)
            //     .attr('transform', `${plotXY(dataPt)} translate(-10, -10)`);
            // g.node().append(s.cloneNode(true));

            let g = d3.select(`#unit-icon-${id}`)
                .append('g')
                .attr("class", "unit")
                .attr("data-toggle", "tooltip")
                .attr("data-placement", "top")
                .attr("title", dataPt.data['Candy'])
                .attr("id", `unit-icon-${id}`)
                .attr('transform', `${plotXY(dataPt)} translate(-10, -10)`);
            g.node().append(s.cloneNode(true));

        }
        curDataAttrs[id].shapeId = shapeId;
    }
}

function changeXAxis(index) {

    // console.log("changin axis", attribute);
    d3.select("#dropdownMenuButton1")
        .text(columns[index]);
    d3.select('#x-axis-label')
        .text(columns[index]);

    //isNumericScale = false;

    // d3.selectAll(".unit").remove();
    // d3.select('.unit svg').remove();
    // // visualize(index);

    // groupByAttribute(currentData, attribute);
    // createVisualization();
    // updateVisualization();

    groupByAttribute(currentData, attribute);
    updateVisualization();
    if (zoomState !== undefined) zoomed(zoomState.x, zoomState.k);
}

function visualize(colindex) {
    attribute = columns[colindex];
    //currentData = groupByAttribute(dataset, attribute);
    groupByAttribute(dataset, attribute);
    createVisualization();
    updateVisualization();
}

function findShape(shape) {
    // console.log("shape", shape, shape.slice(6));
    // console.log(d3.select(".unit svg path"));

    // changing from user svg to d3 shape
    if (!d3.select(".unit svg path").empty()) {
        d3.selectAll(".unit svg path").remove();
        d3.selectAll(".unit svg").attr("xmlns", null).attr("d", null);
        d3.selectAll(".unit svg")
            .attr("width", currSize).attr("height", currSize)
            .append("path").attr("d", all_shapes[shape.slice(6)])
            .attr("transform", "scale(8) translate(10, 10)");
    }
    // changing from d3 shape to user svg
}

function sortAxis(colName) {

    d3.select("#dropdownMenuButton6")
        .text(colName);
}

function filterAxis(colName) {

    d3.select("#double-slider").remove();

    d3.select("#filter-item")
        .append("div")
        .attr("id", "double-slider")
        .append("p")
        .attr("id", "range-text")
        .text("Choose range:");
    // .style("display", "block");

    d3.select("#double-slider")
        .append("input")
        .attr("type", "text")
        .attr("id", "double-range-slider")
        .attr("class", "slider")
        .attr("name", "my_range")
        .attr("value", "");

    d3.select("#dropdownMenuButton7")
        .text(colName);

    let list_items = allData.map((d) => d['data'][colName])

    let max = list_items[0];
    let min = list_items[0];
    list_items.forEach(element => {
        if (element > max) {
            max = element;
        }
        if (element < min) {
            min = element;
        }
    });

    min = (Math.round(min * 100)) / 100;
    max = (Math.round(max * 100)) / 100;

    $("#double-range-slider").ionRangeSlider({
        type: "double",
        min: min,
        max: max,
        from: min,
        to: max,
        step: Math.round((max - min) * 10) / 100,
        // onStart: function(data) {
        //     console.log("onStart");
        // },
        // onChange: function(data) {
        //     console.log("onChange");
        // },
        onFinish: function (data) {
            // console.log("onFinish", data);
            // console.log(data['from'], data['to'])
            filterData(colName, data['from'], data['to'])
        },
    });
}
function updateSelection() {
    // console.log("Selected!");

    let data = d3.selectAll(".selected").data();
    // console.log("selection data", data);

    if (data.length > 1) {

        let candynames = "<i>";
        for (let i = 0; i < data.length; i++) {
            // candynames += "<i>";
            candynames += data[i]['data']['Candy'];
            candynames += "<br>";
        }

        // console.log(candynames);
        // console.log("column ", attribute);

        let quant = "<i>";
        if (typeof (data[0]['data'][attribute]) == "number") {
            // console.log("numeric");
            let total = 0;
            let count = 0;
            let max = data[0]['data'][attribute];
            let min = data[0]['data'][attribute];
            let currval;

            for (let i = 0; i < data.length; i++) {
                currval = data[i]['data'][attribute];
                total += currval;
                count++;

                if (currval > max) {
                    max = currval;
                }
                if (currval < min) {
                    min = currval;
                }
            }
            quant += "Total: ";
            quant += Math.round(total * 100) / 100;
            quant += "<br>Average: ";
            quant += Math.round(total / count * 100) / 100;
            quant += "<br>Min: ";
            quant += Math.round(min * 100) / 100;
            quant += "<br>Max: ";
            quant += Math.round(max * 100) / 100;
        }

        // console.log("quant", quant);

        d3.select("#selection-text")
            .html("<br>" + data.length + " data points are selected.<br><hr><br>The selected candies are: <br>" + candynames + "</i><br><hr><br>Aggregate stats of selected points based on \"" + attribute + "\" is: " + quant + "</i>");

    } else if (data.length == 0) {

        d3.select("#selection")
            .selectAll("body")
            .remove();

        d3.select("#selection")
            .append("xhtml:body")
            .attr("id", "selection-text")
            .html("<br>No points are selected.<br>")

    } else {
        // console.log("1 item selected: ", data);
        let selPt = "";

        selPt += "The selected item is the \"";
        selPt += data[0]['data']['Candy'];
        selPt += "\".<br><br>Its attributes are:<ul class=\"list-group\">";

        // console.log("length", data[0]['data'].length);

        let objData = data[0]['data'];
        let listDim = Object.keys(objData);

        for (let i = 0; i < listDim.length; i++) {
            // console.log(listDim[i], objData[listDim[i]]);
            selPt += "<li class=\"list-group-item\">";
            selPt += listDim[i];
            selPt += ": ";
            selPt += objData[listDim[i]];
            selPt += "</li>"
        }

        selPt += "</ul>"

        // console.log(selPt)

        d3.select("#selection-text")
            .html(selPt)
    }
}

function changeTab() {
    d3.selectAll("#pill-overview-tab")
        .classed("active", false)
        .attr("aria-selected", false)
        .attr("tabindex", "-1")

    d3.selectAll("#pill-chart-tab")
        .classed("active", false)
        .attr("aria-selected", false)
        .attr("tabindex", "-1")

    d3.selectAll("#pill-overview")
        .classed("active", false)
        .classed("show", false)

    d3.selectAll("#pill-chart")
        .classed("active", false)
        .classed("show", false)

    d3.select("#pill-details-tab")
        .classed("active", true)
        .attr("aria-selected", true)
        .attr("tabindex", null)

    d3.selectAll("#pill-details")
        .classed("active", true)
        .classed("show", true)
}


function orderXAxis(radio) {
    attrSortOder = radio.value;
    updateXAttribute(attribute);
}

//Code credits: https://codepen.io/eleviven/pen/eYmwzLp

let onlongtouch = false;
let showToolTip = false;
let timer = false;
let timer2 = false;

function touchStart() {
    if (!timer) {
        timer = setTimeout(onlongtouch, 800);
    }
}

function touchEnd() {
    if (timer) {
        clearTimeout(timer)
        timer = false;
    }
}

onlongtouch = function () {
    // d3.select("#side-panel").style("background-color", "black")

    if (attrSortOder == 0) {
        attrSortOder = 1;
    } else {
        attrSortOder = 0;
    }
    updateXAttribute(attribute);
}

// function touchStartTip(){
//     if (!timer2) {
//       timer2 = setTimeout(showToolTip, 800);
//     }
//   }

// function touchEndTip(){
//     if (timer2) {
//       clearTimeout(timer2)
//       timer2 = false;
//     }
// }

// showToolTip = function(){
//     d3.select("#side-panel").style("background-color", "black");    
// }

document.addEventListener("DOMContentLoaded", function () {
    document.querySelector("#x-axis-label").addEventListener("touchstart", touchStart);
    document.querySelector("#x-axis-label").addEventListener("touchend", touchEnd);

    //   document.querySelector("path").addEventListener("touchstart", touchStartTip);
    //   document.querySelector("path").addEventListener("touchend", touchEndTip);
})
