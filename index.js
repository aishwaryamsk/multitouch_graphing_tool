
let width;
let height;
let margin = { top: 20, right: 30, bottom: 90, left: 30 };

let xScale; // scale for labels on x-axis
let unitXScale; // scale for unit vis on x-axis
let unitYScale; // scale for unit vis on y-axis
let attribute = null;

/* list of {data: {…}, attrs: {…}} 
* store attributes (such as color, shape, atrribute that it's grouped with etc) for each data point
*/
let dataset = [];

// settings
let duration = 1;
let circleRadius = 7;
let attrValuesCount; // keeps count of values in the grouped attribute


$(document).ready(function () {
    height = window.innerHeight - margin.top - margin.bottom;
    width = window.innerWidth - d3.select('#side-panel').node().getBoundingClientRect().width - margin.left - margin.right;
    xScale = d3.scaleBand();
    unitXScale = d3.scaleLinear();
    unitYScale = d3.scaleLinear();
});

Promise.all([d3.csv('dataset/candy-data.csv', candyRow)])
    .then(function (d) {
        dataset = setData(d[0]);
        // CHANGE LATER?: initially, use chocolate as an attribute to group on
        attribute = 'chocolate';
        //attribute = 'sugarPercent';
        let currentData = groupByAttribute(dataset, attribute);
        createVisualization();
        updateVisualization(currentData);
    });

function createVisualization() {
    d3.select("#chart").attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom]);
    d3.select('#content').attr("transform", "translate(" + margin.left + "," + margin.top + ")");
}

function updateVisualization(data) {

    let unitVisPadding = 2; //pixels

    xScale.domain(Object.keys(attrValuesCount)).range([0, width]).paddingInner(.7).paddingOuter(0.7); // takes string as input

    /* let the number of elements per row in each column be at least 1 */
    let numRowElements = Math.floor((xScale.bandwidth() - unitVisPadding) / ((2 * circleRadius) + unitVisPadding));
    numRowElements = numRowElements > 1 ? numRowElements : 1;

    /* x-scale of the attributes */
    
    unitXScale.domain([0, numRowElements]);

    let maxAttributeValueCount = Math.max(...Object.values(attrValuesCount));
    let unitVisHtMargin = 10;

    /* if (numRowElements > 1) {
        let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
        unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)]).range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);
    } else {
        unitYScale.domain([1, Math.ceil(maxAttributeValueCount)]).range([height - unitVisHtMargin, 0]); // number of rows 
    } */

    let yScaleHeight = 2 * circleRadius * (maxAttributeValueCount / numRowElements) * unitVisPadding;
    unitYScale.domain([0, Math.ceil(maxAttributeValueCount / numRowElements)])
        .range([height - unitVisHtMargin, height - unitVisHtMargin - yScaleHeight]);

    d3.select('.x-axis').attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(xScale));


    // if the number of attributes are greater than arbitrary number 5, tilt the labels
    if (Object.keys(attrValuesCount).length > 5)
        d3.select('.x-axis').selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

    // Update data in the visualization
    let elements = d3.selectAll(".unit-vis")
        .selectAll('.unit')
        .data(data, d => d.id);

    // update elements
    elements.transition().duration(duration)
        .attr("cx", function (d) {
            if (attribute != null) {
                if (numRowElements > 1) {
                    // update the range of x-scale for unit vis to the x value of the column
                    let bandwidth = xScale.bandwidth();
                    unitXScale.range([xScale(String(d.data[attribute])),
                    xScale(String(d.data[attribute])) + bandwidth]);

                    return unitXScale((d.attrs.groupBy.order - 1) % numRowElements);
                } else return xScale(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        });

    // add new elements
    elements.enter()
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
                } else return xScale(String(d.data[attribute]));
            }
        })
        .attr("cy", function (d) {
            if (attribute != null) {
                //return unitYScale(d.attrs.groupBy.order);
                /* if (numRowElements > 1) {
                    return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
                } else return unitYScale(d.attrs.groupBy.order); */

                return unitYScale(Math.floor((d.attrs.groupBy.order - 1) / numRowElements));
            }
        })
        .attr('r', circleRadius)
        .style('fill', d => d.attrs.color);

    // remove elements
    elements.exit()
        .transition().duration(duration)
        .attr("r", 0)
        .remove();

    // Update x-axis label
    d3.select('#x-axis-label')
        .text(attribute)
        .attr("x", width / 2)
        .attr("y", height + margin.top + margin.bottom - 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9em")
    //.style("fill", 'dimgrey');
}

/* Helper functions */

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

    // keep count of element's occurrence in each attribute value and store for grouping
    for (let dataPt of data) {
        attrValuesCount[dataPt.data[attribute]]++;
        dataPt.attrs['groupBy'] = {
            'column': attrValues.indexOf(dataPt.data[attribute]),
            'order': attrValuesCount[dataPt.data[attribute]]
        };
    }
    return data;
}

function setData(d) {
    let i = 0;
    for (let dataPt of d) {
        dataset.push({ id: i, data: dataPt, attrs: { color: '#0067cd' } });
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