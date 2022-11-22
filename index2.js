let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let xScale; // scale for labels on x-axis -- reference scale
let unitXScale; // scale for unit vis on x-axis -- reference scale
let unitYScale; // scale for unit vis on y-axis
let xAxis;
let numRowElements;
let tip;

let attribute = null;
let tooltipTriggerList;
let col_values;
let col_types;


/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape, atrribute that it's grouped with etc) for each data point
*/
let dataset = [];
let columns = [];
let isNumericScale = false;

// Holds the current data displayed in the chart
let currentData;
let curDataAttrs = {};

// settings
let duration = 1;
var circleRadius = 7;
let attrValuesCount; // keeps count of values in the grouped attribute
let xAxesLabels = []; // labels of grouped attribute

// selections
let selection = []; // all selected unit vis

/* Multi-touch or multi-pointers */
// Preserving a pointer's event state during various event phases
// Event caches, one per touch target
let evCacheContent = [];
let evCacheXAxis = [];
let prevDiff = -1; // for pinch-zoom -- any direction
let onePointerTappedTwice = false;
let twoPointersTappedTwice = false;

// user preferences
let useCustomIcons = true;
let iconSize = 2 * circleRadius; //default
let unitVisHtMargin = iconSize;
let imgSVGs = [];
let currSize = 20;

let array = [d3.csv('dataset/candy-data.csv'), d3.xml('images/candy.svg')]

let cols_lower, cols;
let all_shapes = [squareShape, triangleShape, circleShape, crossShape, diamondShape, starShape, wyeShape]
// console.log("shapes", all_shapes);

Promise.all(array).then(function (data1) {

    let imgSVG = data1[1];
    let svgNode = imgSVG.getElementsByTagName("svg")[0];
    d3.select(svgNode)
        .attr('height', 20)
        .attr('width', 20)
        .style('fill', "#874612");
    iconSize = 20;
    imgSVGs.push(svgNode);

    let data = data1;
    data[0].forEach(d => {
        for (let attr in d) {
            if (attr !== 'Candy')
                d[attr] = +d[attr];
        }
    });

    dataset = setData(data[0]);
    columns = data[0].columns;
    console.log("cols", columns)
    // CHANGE LATER?: initially, use chocolate as an attribute to group on
    //attribute = 'fruity';
    // attribute = columns[10];
    visualize(11);
    
    for (let i=0; i<7; i++){
        d3.select("#shapes")
        .append("svg")
        .attr("width", "20")
        .attr("height", "20")
        .append("path")
        .attr("class", "pickShape")
        .style("cursor", "pointer")
        .attr("id", (d) => "shape-"+i)
        .attr("d", all_shapes[i])
        .attr("fill", "#874612")
        .attr("transform", "translate(10, 10)")
        .on('pointerdown', function(e,d){
            // console.log("att", e['target']['id']);
            findShape(e['target']['id']);
        })
    }

    cols = Object.keys(dataset[0].data)
    col_values = Object.values(dataset[0].data)
    col_types = col_values.map((d) => typeof(d));
    overview(dataset.length, cols.length);
    tabulate(dataset, cols);
    createAccordion(dataset, cols);
    createDropDown(dataset, cols);

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
        .html("<br>Lasso-select datapoints to view stats.<br>")

});

function createVisualization() {
    // Initialize variables
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    unitXScale = d3.scaleLinear();
    unitYScale = d3.scaleLinear();


    // d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
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
}

function updateVisualization() {
    /* try {
        let imgSVG = await getImgSVG();
    } catch (err) {
        console.log(err);
    } */
    let unitVisPadding = 1.5; //pixels
    setNumericScale()
    // set the x scale based on type of data
    if (isNumericScale) { // numeric scale
        xScale = d3.scaleLinear();
        let minMax = d3.extent(currentData, function (d) {
            return d.data[attribute];
        });
        xScale.domain(minMax).range([0, width]); // takes number as input
    } else { // categorical scale (yes/no)
        xScale = d3.scaleBand();
        xScale.domain(Object.keys(attrValuesCount)).range([0, width]).paddingInner(.7).paddingOuter(0.7); // takes string as input

        // set number of elements in each column
        numRowElements = Math.floor((xScale.bandwidth() - unitVisPadding) / ((2 * circleRadius) + unitVisPadding));
    }

    /* let the number of elements per row in each column be at least 1 */
    numRowElements = numRowElements > 1 ? numRowElements : 1;

    /* x-scale of the attributes */
    unitXScale.domain([0, numRowElements]);

    let maxAttributeValueCount = Math.max(...Object.values(attrValuesCount));
    unitVisHtMargin = iconSize;

    /* if (numRowElements > 1) {
        let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
        unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)]).range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);
    } else {
        unitYScale.domain([1, Math.ceil(maxAttributeValueCount)]).range([height - unitVisHtMargin, 0]); // number of rows 
    } */

    let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
    unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)])
        .range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);


    // add x-axis
    xAxis = d3.axisBottom(xScale).tickSize(4);

    d3.select('.unit-vis')
        .attr('clip-path', 'url(#clipx)');

    d3.select('.x-axis')
        .call(xAxis);


    if (!isNumericScale)
        d3.select('.x-axis')
            .selectAll("text")
            .text((d, i) => xAxesLabels[i]);

    // Update data in the visualization
    updateUnitViz();

    // Update x-axis label
    d3.select('#x-axis-label')
        // .text(attribute)
        .attr("x", width / 2)
        .attr("y", margin.top + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
    //.style("fill", 'dimgrey');

    // Enable Lasso selection for unit visualization -- for the svg and the units within it
    lasso.targetArea(d3.select('#lasso-selectable-area'))
        .items(d3.selectAll('#chart-content .unit'));
    d3.select("#chart").call(lasso).call(chartZoom);
}

function getImgSVG() {
    return new Promise((resolve, reject) => function () {
        d3.xml("/images/candy.svg").then(data => {
            console.log(data)
            imgSVG = data;
            resolve(imgSVG);
            //d3.select("#svg-container").node().append(data.documentElement)
        });
    })

}

function updateImgSVG() {
    //imgSVG.style('stroke', 'pink').attr('fill', 'pink');
}

// var did_it_once = false;
function updateUnitViz(tx = 1, tk = 1) {

    let units = d3.selectAll("#chart-content .unit-vis")
        .selectAll('.unit')
        .data(currentData, d => d.id);

    if (useCustomIcons) {
        let svgs = units.join("g") //image
            .attr("class", "unit")
            .attr("id", (d, i) => `unit-icon-${i}`)
            .attr("data-toggle", "tooltip")
            .attr("data-placement", "top")
            .attr("title", (d, i) => d['data']['Candy'])
            //.attr("xlink:href", "https://s27.postimg.org/h3xjrsnrn/dcpolicycenter.png")
            // .attr("d", function (d) {
            //     let node = document.importNode('/images/candy.svg', true);
            //})
            .attr('transform', d => plotXY(d, tx, tk));

        if (d3.select('.unit svg').empty()) {
            // create
            svgs.each(function (d) {
                // clones whole subtree -- has to be cloned for each instance of the candy
                let s = imgSVGs[curDataAttrs[d.id].imgSvgId];
                /* d3.select(s).style('fill', curDataAttrs[d.id].color); */
                //this.append(imgSVGs[curDataAttrs[d.id].imgSvgId].cloneNode(true));
                this.append(s.cloneNode(true));
            });
        }
    } else {
        // console.log("color", color)
        units.join("path")
            .attr("class", "unit")
            .attr('d', d => curDataAttrs[d.id].shape)
            .style('fill', d => curDataAttrs[d.id].color)
            .attr('transform', d => plotXY(d, tx, tk));
    }

    d3.selectAll(".unit svg rect")
    // .style("fill", "black")
    .attr("fill", "none");
}

function plotXY(d, tx = 1, tk = 1) {
    let x, y;
    if (attribute != null) {
        let order = curDataAttrs[d.id]['groupBy'].order;
        if (numRowElements > 1) {
            // update the range of x-scale for unit vis to the x value of the column
            bandwidth = xScale.bandwidth();
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
        .attr('width', 18)
        .style('fill', 'grey');
    imgSVGs.push(svgNode);
    console.log('imgSVG', imgSVGs);
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
    if (Object.keys(attrValuesCount).length === 2) {
        xAxesLabels[0] = `No ${attribute}`;
        xAxesLabels[1] = `${attribute}`;
    }

    // keep count of element's occurrence in each attribute value and store for grouping
    for (let dataPt of data) {
        attrValuesCount[dataPt.data[attribute]]++;
        curDataAttrs[dataPt.id]['groupBy'] = {
            'column': attrValues.indexOf(dataPt.data[attribute]),
            'order': attrValuesCount[dataPt.data[attribute]]
        };
    }
    return data;
}

function setData(d) {
    let i = 0;
    for (let dataPt of d) {
        //dataset.push({ id: i, data: dataPt, attrs: { color: '#0067cd', shape: circleShape(), imgSvgId: 0 } });
        dataset.push({ id: i, data: dataPt });
        // console.log("datapoint", dataPt);
        curDataAttrs[i] = { color: '#0067cd', shape: circleShape(), imgSvgId: 0 };
        i++;
    }
    return dataset;
}

function candyRow(d) {
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
};

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
    // updateSelection();
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
        // select all unit vis on single pointer double tap
        selection = d3.selectAll('#chart-content .unit')
            .classed("selected", false)
            .attr('r', circleRadius); // reset radius of unselected points;
        console.log('1 pointer double tap');
        // updateSelection();

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
        // transform texts
        gXAxis.selectAll("text")
            .attr("transform", `${d3.zoomIdentity.scale(1 / t.k)} `);
    }
    // transform circles along x-axis only
    updateUnitViz(t.x, t.k);
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
    if ($('#evCacheXAxis').has(ev.target).length)
        return evCacheXAxis;
    else return evCacheContent;
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
        updateSelection();
        changeTab();
        //console.log('selectedItems', lasso.selectedItems());
    });

function lassoStart() {
    lasso.items()
        .attr('r', circleRadius) // reset radius
        .classed("not_possible", true)
        .classed("selected", false);

    // updateSelection();
};

function lassoDraw() {
    lasso.possibleItems()
        .classed("not_possible", false)
        .classed("possible", true)
        .attr('r', circleRadius);
    lasso.notPossibleItems()
        .classed("not_possible", true)
        .classed("possible", false)
        .attr('r', circleRadius / 2); // decrease radius of not possible points
};

function lassoEnd() {
    lasso.items()
        .classed("not_possible", false)
        .classed("possible", false);

    // if nothing is selected, keep element radius as unchanged
    if (lasso.selectedItems().size() === 0) {
        lasso.notSelectedItems()
            .classed("selected", false)
            .attr('r', circleRadius); // reset radius of unselected points
    }

    

    /* the radius of possible points (which becomes selected now) will remain as 'circleRadius'.
    So, only update the radius of unselected points. */
    lasso.selectedItems()
        .classed("selected", true);
    lasso.notSelectedItems()
        .classed("selected", false)
        .attr('r', circleRadius); // reset radius of unselected points
    
    // updateSelection();
        
};

function unselectPoints() {
    lasso.notSelectedItems()
        .attr('r', circleRadius); // reset radius of unselected points

    // updateSelection();
}

function tabulate(data, cols){
    var table = d3.select("#thetablebody").append("table").attr("class", "table table-striped");
    var head = table.append("thead")
    var body = table.append("tbody")

    console.log("columns", cols);
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

function createAccordion(data, cols){
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
        .attr("id", (d, i) => "acc-heading-"+i)
        .append("button")
        .attr("class", "accordion-button collapsed")
        .attr("type", "button")
        .attr("data-bs-toggle", "collapse")
        .attr("data-bs-target", (d, i) => "#acc-"+i)
        .attr("aria-controls", (d, i) => "acc-"+i)
        .attr("aria-expanded", "false")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))

    accitem.append("div")
        .attr("class", "accordion-collapse collapse")
        .attr("id", (d, i) => "acc-"+i)
        .attr("aria-labelledby", (d, i) => "acc-heading-"+i)
        .attr("data-bs-parent", (d) => "#dim")
        .append("div")
        .attr("class", "accordion-body")
        .append("xhtml:body")
        .html((d) => stats(data, d));
        
}

function createDropDown(data, cols){

    d3.select("#dropdown-menu1")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        .attr("class", "dropdown-item")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function(e,d){
            
            let index = columns.indexOf(d);
            console.log("att", d, index);
            changeXAxis(index);
        });  

    d3.select("#dropdown-menu3")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        .attr("class", "dropdown-item")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function(e,d){
            console.log("att", d);
            // changeXAxis(d);
        });  
    
    d3.select("#dropdown-menu4")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        // .attr("class", "dropdown-item")
        .attr("class", (d, i)=> {if(col_types[i] != "string") { return "dropdown-item disabled";} else { return "dropdown-item"}})
        .attr("tabindex", (d, i)=> {if(col_types[i] != "string") { return "-1";}})
        .attr("aria-disabled", (d, i)=> {if(col_types[i] != "string") { return "true";}})
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function(e,d){
            console.log("att", d);
            // changeXAxis(d);
        }); 
    
    d3.select("#dropdown-menu5")
        .selectAll("li")
        .data(cols)
        .enter()
        .append("li")
        .append("a")
        // .attr("class", "dropdown-item")
        .attr("class", (d, i)=> {if(col_types[i] == "string") { return "dropdown-item disabled";} else { return "dropdown-item"}})
        .attr("tabindex", (d, i)=> {if(col_types[i] == "string") { return "-1";}})
        .attr("aria-disabled", (d, i)=> {if(col_types[i] == "string") { return "true";}})
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function(e,d){
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
        .attr("class", (d, i)=> {if(col_types[i] == "string") { return "dropdown-item disabled";} else { return "dropdown-item"}})
        .attr("tabindex", (d, i)=> {if(col_types[i] == "string") { return "-1";}})
        .attr("aria-disabled", (d, i)=> {if(col_types[i] == "string") { return "true";}})
        .text((d) => (d[0].toUpperCase() + d.slice(1)))
        .on('pointerdown', function(e,d){
            console.log("filter", d);
            filterAxis(d);
        });  

}

function stats(data, colname){    

    // if(typeof(list_items[0]) == "string")
    console.log(typeof(data[0]['data'][colname]))
    if (typeof(data[0]['data'][colname]) != "number"){
        console.log(data)
        let list_items = data.map((d) => d['data'][colname])
        return "Number of items: " + list_items.length;

    }else{

        // console.log("Column: ", colname, data[0]['data'][colname]);
        let total =0;
        let count =0;
        let max = data[0]['data'][colname];
        let min = data[0]['data'][colname];
        let quant = "";

        let currval;

        for (let i=0; i< data.length; i++){
            currval = data[i]['data'][colname];
            total += currval;
            count++;

            if (currval > max){
                max = currval;
            }
            if(currval < min){
                min = currval;
            }
        }
        quant += "Total: ";
        quant += Math.round(total*100)/100;
        quant += "<br>Average: ";
        quant += Math.round(total/count*100)/100;
        quant += "<br>Min: ";
        quant += Math.round(min*100)/100;
        quant += "<br>Max: ";
        quant += Math.round(max*100)/100;

        // console.log(quant);

        return quant;
    }  
}

function overview(rows, columns){
    d3.select("#overview_num").text("The dataset has " + rows + " rows and " + columns + " columns.");
    d3.select("#overview").text("Data attributes");
}

function getColforSize(colname){

    let list_items = dataset.map((d) => d['data'][colname])

    let max =list_items[0];
    let min = list_items[0];
    list_items.forEach(element => {
        if(element>max){
            max = element;
        }
        if(element<min){
            min = element;
        }
    });
    console.log("Range", min, max); 
    changeSizeByCol(colname, min, max);
}

function changeSizeByCol(colname, min, max){
    // console.log("data", currentData);

    d3.select("#dropdownMenuButton5")
        .text(colname);

    for (let i=0; i<currentData.length; i++){
        let name = "#unit-icon-" + i + " svg";
        let currsize = currentData[i]['data'][colname];
        let reqsize = (((currsize-min)*(40-10))/(max-min)) + 10;

        console.log("curr", reqsize);
        d3.select(name).attr('width', reqsize).attr('height', reqsize);
    }
}

function changeColor(newColor){
    console.log("changing color", currentData.length);

    // let imgSVG = data1[1];
    // let svgNode = imgSVG.getElementsByTagName("svg")[0];

    for (let i=0; i<currentData.length; i++){
        let name = "#unit-icon-" + i + " svg";
        d3.select(name).style('fill', newColor);
    }    

    d3.selectAll("#shapes svg path").style('fill', newColor);
}

function changeSize(newSize){
    console.log("changing color", newSize);

    // let reqsize = (newSize/4) + 15;
    for (let i=0; i<currentData.length; i++){
        let name = "#unit-icon-" + i + " svg";
        d3.select(name).attr('width', newSize).attr('height', newSize);
    }

}

function changeXAxis(index){

    // console.log("changin axis", attribute);
    d3.select("#dropdownMenuButton1")
        .text(columns[index]);
    d3.select('#x-axis-label')
        .text(columns[index]);
    

    d3.selectAll(".unit").remove();
    d3.select('.unit svg').remove();
    visualize(index);
}

function visualize(colindex){
    attribute = columns[colindex];
    currentData = groupByAttribute(dataset, attribute);
    createVisualization();
    updateVisualization();
}

function findShape(shape){
    console.log(shape, shape.slice(6));

    d3.selectAll(".unit svg path").remove();
    d3.selectAll(".unit svg").attr("xmlns", null).attr("d", null)
    d3.selectAll(".unit svg")
        .attr("width", currSize).attr("height", currSize)
        .append("path").attr("d", all_shapes[shape.slice(6)])
        .attr("transform", "scale(8) translate(10, 10)")
        // .attr("transform", "translate(25, 25)")
}

function sortAxis(colName){

    d3.select("#dropdownMenuButton6")
        .text(colName);
}

function filterAxis(colName){

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
        .attr("name", "my_range")
        .attr("value", "");

    d3.select("#dropdownMenuButton7")
        .text(colName);

    let list_items = dataset.map((d) => d['data'][colName])

    let max =list_items[0];
    let min = list_items[0];
    list_items.forEach(element => {
        if(element>max){
            max = element;
        }
        if(element<min){
            min = element;
        }
    });
    console.log("Range", min, max); 

    min = (Math.round(min*100))/100;
    max = (Math.round(max*100))/100;

    $("#double-range-slider").ionRangeSlider({
        type: "double",
        min: min,
        max: max,
        from: min,
        to: max,
        step: Math.round((max-min)*10)/100,
        // grid: true
    });
}

function updateSelection(){
    // console.log("Selected!");

    let data = d3.selectAll(".selected").data();
    // console.log("selection data", data);

    if(data.length !=0){

        let candynames = "<i>";
    for (let i=0; i< data.length; i++){
        // candynames += "<i>";
        candynames += data[i]['data']['Candy'];
        candynames += "<br>";
    }

    // console.log(candynames);
    // console.log("column ", attribute);

    let quant = "<i>";
    if (typeof(data[0]['data'][attribute]) == "number"){
        // console.log("numeric");
        let total = 0;
        let count = 0;
        let max = data[0]['data'][attribute];
        let min = data[0]['data'][attribute];
        let currval;

        for (let i=0; i< data.length; i++){
            currval = data[i]['data'][attribute];
            total += currval;
            count++;

            if (currval > max){
                max = currval;
            }
            if(currval < min){
                min = currval;
            }
        }
        quant += "Total: ";
        quant += Math.round(total*100)/100;
        quant += "<br>Average: ";
        quant += Math.round(total/count*100)/100;
        quant += "<br>Min: ";
        quant += Math.round(min*100)/100;
        quant += "<br>Max: ";
        quant += Math.round(max*100)/100;
    }

    // console.log("quant", quant);

    d3.select("#selection-text")
        .html("<br>" + data.length + " data points are selected.<br><hr><br>The selected candies are: <br>"+ candynames + "</i><br><hr><br>The aggregate stats of selected points based on \"" + attribute + "\" is: " + quant + "</i>");

    } else{

        d3.select("#selection")
        .selectAll("body")
        .remove();

        d3.select("#selection")
        .append("xhtml:body")
        .attr("id", "selection-text")
        .html("<br>No points are selected.<br>")

    }

}

function changeTab(){
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