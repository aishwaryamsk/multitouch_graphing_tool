let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let xScale; // scale for labels on x-axis -- reference scale
let unitXScale; // scale for unit vis on x-axis -- reference scale
let unitYScale; // scale for unit vis on y-axis
let xAxis;
let numRowElements;

let attribute = null;


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
let circleRadius = 7;
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

    dataset = setData(data[0]);
    columns = data[0].columns;
    // CHANGE LATER?: initially, use chocolate as an attribute to group on
    //attribute = 'fruity';
    //attribute = columns[11];
    attribute = columns[1];
    //attribute = 'sugarPercent';
    //attribute = 'winPercent';
    //attribute = 'pricePercent';
    currentData = groupByAttribute(dataset, attribute);
    

    // Niv
    cols = Object.keys(dataset[0].data)
    overview(dataset.length, cols.length);
    tabulate(dataset, cols);
    createAccordion(dataset, cols);
    createDropDown(dataset, cols);

    createVisualization();
    updateVisualization();
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
    //updateUnitVizIcons();

    // update elements
    /* elements.transition().duration(duration)
        .attr("cx", function (d) {
            if (attribute != null) {
                if (numRowElements > 1) {
                    // update the range of x-scale for unit vis to the x value of the column
                    let bandwidth = xScale.bandwidth();
                    unitXScale.range([xScale(String(d.data[attribute])),
                    xScale(String(d.data[attribute])) + bandwidth]);
                    return unitXScale((d.attrs.groupBy.order - 1) % numRowElements);
                } else return xScale(d.data[attribute]); // numeric scale
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        }); */

    // add new elements
    /* elements.enter()
        .append("circle")
        .attr("class", "unit")
        .attr("cx", function (d) {
            if (attribute != null) {
                if (numRowElements > 1) {
                    // update the range of x-scale for unit vis to the x value of the column
                    bandwidth = xScale.bandwidth();
                    unitXScale.range([xScale(String(d.data[attribute])),
                    xScale(String(d.data[attribute])) + bandwidth]);
                    return unitXScale((d.attrs.groupBy.order - 1) % numRowElements);
                } else return xScale(d.data[attribute]); // numeric scale
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                //return unitYScale(d.attrs.groupBy.order);
                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        })
        .attr('r', circleRadius)
        .style('fill', d => d.attrs.color); 

    // remove elements
    elements.exit()
        .transition().duration(duration)
        .attr("r", 0)
        .remove(); */

    // Update x-axis label
    d3.select('#x-axis-label')
        .text(attribute)
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

function updateUnitViz(tx = 1, tk = 1) {

    let units = d3.selectAll("#chart-content .unit-vis")
        .selectAll('.unit')
        .data(currentData, d => d.id);

    if (useCustomIcons) {
        let svgs = units.join("g") //image
            .attr("class", "unit")
            .attr("id", (d, i) => `unit-icon-${i}`)
            //.attr("xlink:href", "https://s27.postimg.org/h3xjrsnrn/dcpolicycenter.png")
            // .attr("d", function (d) {
            //     let node = document.importNode('/images/candy.svg', true);
            //})
            .attr('transform', d => plotXY(d, tx, tk))

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
        /* svgs.selectAll('.path-icon') //paths worked
           .data(paths.nodes())
           .join("path")
           .attr('class', 'path-icon')
           .attr("d", function (d) {
               return d3.select(d).attr('d');
           })
           .attr("stroke", function (d) {
               return d3.select(d).attr('stroke');
           })
           .attr("stroke-width", function (d) {
               return d3.select(d).attr('stroke-width');
           })
           .attr("stroke-linecap", function (d) {
               return d3.select(d).attr('stroke-linecap');
           })
           .attr("fill", function (d) {
               return d3.select(d).attr('fill');
           }) */

    } else {
        units.join("path")
            .attr("class", "unit")
            .attr('d', d => curDataAttrs[d.id].shape)
            .style('fill', d => curDataAttrs[d.id].color)
            .attr('transform', d => plotXY(d, tx, tk));
    }
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
        .style('fill', 'plum');
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
        //console.log('selectedItems', lasso.selectedItems());
    });

function lassoStart() {
    lasso.items()
        .attr('r', circleRadius) // reset radius
        .classed("not_possible", true)
        .classed("selected", false);
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

    selection = lasso.selectedItems();

    /* the radius of possible points (which becomes selected now) will remain as 'circleRadius'.
    So, only update the radius of unselected points. */
    lasso.selectedItems()
        .classed("selected", true);
    lasso.notSelectedItems()
        .classed("selected", false)
        .attr('r', circleRadius); // reset radius of unselected points
};

function unselectPoints() {
    lasso.notSelectedItems()
        .attr('r', circleRadius); // reset radius of unselected points
}







/* Niveditha */
function tabulate(data, cols) {
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
        .attr("id", (d) => "acc-heading-" + d)
        .append("button")
        .attr("class", "accordion-button collapsed")
        .attr("type", "button")
        .attr("data-mdb-toggle", "collapse")
        .attr("data-mdb-target", (d) => "#acc-" + d)
        .attr("aria-controls", (d) => "acc-" + d)
        .attr("aria-expanded", "false")
        .text((d) => (d[0].toUpperCase() + d.slice(1)))

    accitem.append("div")
        .attr("class", "accordion-collapse collapse")
        .attr("id", (d) => "acc-" + d)
        .attr("data-mdb-target", (d) => "#dim")
        .append("div")
        .attr("class", "accordion-body")
        .text((d) => stats(data, d));

}

function createDropDown(data, cols) {
    var id;
    for (let i = 1; i <= 5; i++) {

        id = "#dropdown-menu" + i;

        d3.select(id)
            .selectAll("li")
            .data(cols)
            .enter()
            .append("li")
            .append("a")
            .attr("class", "dropdown-item")
            .text((d) => (d[0].toUpperCase() + d.slice(1)))

    }
}

function stats(data, colname) {
    var list_items = data.map((d) => d['data'][colname])

    console.log("list", typeof (list_items[0]))

    if (typeof (list_items[0]) == "string") {
        return "Number of items: " + list_items.length;
    } else {

        var total = 0;
        var count = 0;
        list_items.forEach(element => {
            total += element;
            count++;
        });
        return "Average: " + Math.round(total / count * 100) / 100;
    }
}

function overview(rows, columns) {
    d3.select("#overview_num").text("The dataset has " + rows + " rows and " + columns + " columns.");
    d3.select("#overview").text("Data Attributes");
}

/* document.getElementById("colorPicker").addEventListener("input", function(){
    setData(dataset);
})  */

function updateColor(color) {
    console.log(color);
}