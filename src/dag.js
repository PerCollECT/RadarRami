let scale;
let svgSelection;
let defs;
let layout;
let dag;
let nodes;
let graph;
let width = 600, height = 400;
let maxTextLength = 200;
let nodeWidth = maxTextLength + 20;
let nodeHeight = 100;

// Define the zoom function for the zoomable tree
var zoom = d3.zoom()
      .scaleExtent([1, 10])
      //.translateExtent([[0, 0], [width, height]])
      .on('zoom', function(event) {
        graph
            .attr('transform', event.transform);
});

// How to draw edges
const line = d3
.line()
.curve(d3.curveCatmullRom)
.x((d) => d.x + nodeWidth/2)
.y((d) => d.y + nodeHeight/2);


function initGraph() {
    // fetch data and render
    data = JSON.parse(getDataFromSessionStorage(repoName + "Tree"));
    dag = d3.dagStratify()(data);
    layout = d3
      .sugiyama() // base layout
      .decross(d3.decrossTwoLayer().order(d3.twolayerAgg())) // minimize number of crossings
      .nodeSize((node) => [(node ? 3.6 : 0.25) * nodeWidth, 3 * nodeWidth]); // set node size instead of constraining to fit
    const { width, height } = layout(dag);
    
    // --------------------------------
    // This code only handles rendering
    // --------------------------------
    svgSelection = d3.select("svg");
    svgSelection.attr("viewBox", [0, 0, width, height].join(" "));
    svgSelection.call(zoom);
    graph = svgSelection.append("g");
    
    defs = graph.append("defs"); // For gradients
   

    const steps = dag.size();
    const interp = d3.interpolateRainbow;
    const colorMap = new Map();
    for (const [i, node] of dag.idescendants().entries()) {
      colorMap.set(node.data.id, interp(i / steps));
    }
  
    
  
    // Plot edges
    graph
      .append("g")
      .selectAll("path")
      .data(dag.links())
      .enter()
      .append("path")
      .attr("d", ({ points }) => line(points))
      .attr("fill", "none")
      .attr("stroke-width", 3)
      .style("stroke", "#222222");
  
    // Select nodes
    nodes = graph
      .append("g")
      .selectAll("g")
      .data(dag.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);
  
    // Plot nodes
    nodes
      .append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", function (d) {
        switch (d.data.nodeType) {
          case "designParameter":
            return 40;
          case "systemIndependent":
            return 40;
          default:
            return 2;
        }
      })
      .attr("stroke-width", 1.5)
      .style("fill", function (d) {
        switch (d.data.nodeType) {
          case "designParameter":
            return "#b4acd2";
          case "systemIndependent":
            return "#ace3b5";
          default:
            return "#f4f4f9";
        }
      })
      .on("click", onTreeNodeClicked);
  
    // Add text to nodes
    nodes
      .append("text")
      .attr("y", nodeHeight / 2)
      .attr("x", 13)
      .attr("dy", ".35em")
      .text((d) => d.data.title)
      .call(wrapNodeText, maxTextLength)
      .on("click", onTreeNodeClicked);
      //.style("fill-opacity", 1e-6)
    
    // Add information icon
    nodes.append("circle")
      .attr("class", "iButton")
      .attr("cx", nodeWidth-20)
      .attr("cy", 20)
      .attr("r", 15)
      .on("mouseover", function () { d3.select(this).attr("r", 20); })
      .on("mouseout", function () { d3.select(this).attr("r", 15); })
      .on("click", onTreeInfoClicked);

    nodes.append("text")
      .attr("class", "iText")
      .attr("y", 26.5)
      .attr("x", nodeWidth - 20 - (5 / 2))
      .html("i");
  };

/**
 * Interface to parse all data starting at
 * @param {String} host of xml root file
 * @param {String} dataDict dictionary at domain where the data is located
 * @param {String} jsonRootFile file name of xml file defines three root
 */
 function parseData(host, dataDict, jsonDataFile) {
  let jsonRootFullPath = (window.location.href.includes("localhost") || window.location.href.includes("127.0.")) ?
  `./${jsonDataFile}` : `${host}${dataDict}${jsonDataFile}`;

  var rawFile = new XMLHttpRequest();
  rawFile.open("GET", jsonRootFullPath, false);
  var allText;
  rawFile.onreadystatechange = function ()
  {
      if(rawFile.readyState === 4)
      {
          if(rawFile.status === 200 || rawFile.status == 0)
          {
              allText = rawFile.responseText;
          }
      }
  }
  rawFile.send(null);
  data = JSON.parse(allText);

  return data;
 }


 let currentInfoboxNode = null;
 /**
  * Performs action after the info label is clicked
  * @param {Object} d clicked info
  */
 function onTreeInfoClicked(d) {
    currentInfoboxNode = d.currentTarget.__data__.data;
    let node = getNodeByTitle(d.currentTarget.__data__.data.title);
    $("#info_box").empty();
    addNodeInfos(node, "preview");
    document.getElementById("preview").scrollIntoView({ behavior: 'smooth' });
    //event.stopPropagation();
    collapseTreeTable();
    updateTreePlot(d);
 }

/**
 * Performs action after the a node is clicked
 * @param {Object} d clicked info
 */
 function onTreeNodeClicked(d) {
  currentInfoboxNode = d.currentTarget.__data__.data;
  let node = getNodeByTitle(d.currentTarget.__data__.data.title);
  $("#info_box").empty();
  addNodeInfos(node, "preview");
  //d3.event.stopPropagation();
  collapseTreeTable();
  updateTreePlot(d);
}

/**
 * Method wraps long labels of nodes into multiple line label
 * @param {String} text labels
 * @param {Number} width max width of one line
 */
 function wrapNodeText(text, width) {
  text.each(function (d) {
      let textd3 = d3.select(this);
      if (textd3.node().getComputedTextLength() < width) return;
      //let words = textd3.text().split(new RegExp(/(?<=[.\-_\s+])/)).reverse();
      let words = textd3.text().split(" ").reverse();
      // split into lines
      let word;
      let line = [];
      let lineNumber = 0;
      let lineHeight = 1; // ems
      let x = textd3.attr('x');
      let y = textd3.attr('y');
      let dy = 0;
      let tspan = textd3.text(null)
          .append('tspan')
          .attr('x', x)
          .attr('y', y)
          .attr('dy', dy );
      while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(' '));
          if (tspan.node().getComputedTextLength() > width) {
              line.pop();
              tspan.text(line.join(' '));
              line = [word];
              tspan = textd3.append('tspan')
                  .attr('x', x)
                  .attr('y', y)
                  .attr('dy', ++lineNumber * lineHeight + dy + 'em')
                  .text(word);
          }
      }
      // set new box height
      let factor = 19 - lineNumber;
      //d3.select(this.parentNode.childNodes[0]).attr("height", factor * (lineNumber + 1));
  });
}

/**
 * Performs tree update. Updates nodes and links.
 * @param {Object} source
 */
 function updateTreePlot(source) {
  let i = 0;
  /*let nodes = layout.nodes(dag).reverse();
  let links = layout.links(nodes).filter(function (l) {
      return nodes.includes(l.source)
          && nodes.includes(l.target)
  });*/

  // ======== apply decomposition block repositioning ========
  /*nodes.forEach(function (d) {
      prepareNodeDepth(d);
      d.y = d.depth * 80;
      if (d == root) d.y += 15;
  });*/

  // ======== update nodes and text elements ========
  /*let node = svgGroup.selectAll("g.node")
      .data(nodes, function (d) { return d.id || (d.id = ++i); });

  let nodeEnter = node.enter().append("g")
      .attr("class", function(d){ return d.id == "root" ? "node-root" : "node";})
      .attr("transform", function (d) { return `translate(${source.x0},${source.y0})`; });

  nodeEnter.append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", function (d) {
          return (d.systemIndependentCause=="true" || d.designParameterCause=="true") ? 20 : 2;
      })
      .attr("stroke-width", 1.5)
      .style("fill", function (d) {
          if (d.designParameterCause=="true") return "#b4acd2";
          return (d.systemIndependentCause=="true") ? "#ace3b5" : "#f4f4f9";
      })
      .on("click", onTreeNodeClicked);

  nodeEnter.append("text")
      .attr("y", nodeHeight / 2)
      .attr("x", 13)
      .attr("dy", ".35em")
      .text(function (d) { return d.name; })
      .call(wrapNodeText, maxTextLength)
      .style("fill-opacity", 1e-6)
      .on("click", onTreeNodeClicked);

  nodeEnter.append("circle")
      .attr("class", "iButton")
      .attr("cx", nodeWidth)
      .attr("r", 10)
      .on("mouseover", function () { d3.select(this).attr("r", 15); })
      .on("mouseout", function () { d3.select(this).attr("r", 10); })
      .on("click", onTreeInfoClicked);

  nodeEnter.append("text")
      .attr("class", "iText")
      .attr("y", 6.5)
      .attr("x", nodeWidth - (5 / 2))
      .html("i");

  let nodeUpdate = node.transition()
      .duration(duration)
      .attr("transform", function (d) { return `translate(${d.x},${d.y})`; });

  nodeUpdate.select("rect")
      .attr("width", nodeWidth)
      .attr("stroke-width", 1.5);

  nodeUpdate.select("text").style("fill-opacity", 1);

  let nodeExit = node.exit().transition()
      .duration(duration)
      .attr("transform", function (d) { return `translate(${source.x},${source.y})`; })
      .remove();

  nodeExit.select("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight);

  nodeExit.select("text")
      .style("fill-opacity", 1e-6);*/


  graphs = graph.selectAll("path");
  paths = graphs._groups[0];
  paths.forEach(function (d) {
      source = d.__data__.source.data;
      target = d.__data__.target.data;
      check = currentInfoboxNode;
      if (currentInfoboxNode.id == source.id) {
        d.setAttribute("stroke-width", "10");
        d.setAttribute("style", "stroke: rgb(255, 0, 0);");
      }
      else if (currentInfoboxNode.id == target.id) {
        d.setAttribute("stroke-width", "10");
        d.setAttribute("style", "stroke: rgb(0, 0, 255);");
      }
      else {
        d.setAttribute("stroke-width", "1.5");
        d.setAttribute("style", "stroke: rgb(34, 34, 34);");
      }
  });

  // ======== update links ========
  /*graph
      .append("g")
      .selectAll("path")
      .data(dag.links())
      .enter()
      .append("path")
      .attr("d", ({ points }) => line(points))
      .attr("fill", "none")
      .attr("stroke-width", 3)
      .attr("stroke", ({ source, target }) => {
        // encodeURIComponents for spaces, hope id doesn't have a `--` in it
        const gradId = encodeURIComponent(`${source.data.id}--${target.data.id}`);
        const grad = defs
          .append("linearGradient")
          .attr("id", gradId)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", source.x)
          .attr("x2", target.x)
          .attr("y1", source.y)
          .attr("y2", target.y);
        grad
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "#222222");
        grad
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "#222222");
        return `url(#${gradId})`;
      });





  let link = svgSelection.selectAll("path.link")
      .data(dag.links, function (d) { return d.target.id; });

  link.enter().insert("path", "g")
      .attr("class", function(d){ return d.source.id == "root" ? "link-root" : "link"; })
      .attr("x", nodeWidth / 2)
      .attr("y", nodeHeight / 2)
      .attr("d", function (d) {
          var o = { x: source.x0, y: source.y0 };
          return diagonal({ source: o, target: o });
      });

  link.transition()
      .duration(duration)
      .attr("d", diagonal)
      .attr("stroke-width", function (d) {
          if (currentInfoboxNode == null) return;
          return (d.source == currentInfoboxNode
              || d.target == currentInfoboxNode) ? 2.7 : 2.0;
      })
      .style("stroke", function (d) {
          if (currentInfoboxNode == null) return;
          if (d.source == currentInfoboxNode) return "#f23d3d";
          if (d.target == currentInfoboxNode) return "#2185ff";
          return "#A9A9A9"
      });

  link.exit().transition()
      .duration(duration)
      .attr("d", function (d) {
          let o = { x: source.x, y: source.y };
          return diagonal({ source: o, target: o });
      })
      .remove();


  // ======== update additional links ========
  // WORKAROUND: add additional links defined in  
  // additionalLinks so that childs can have multiple parents
  let mpLink = svgGroup.selectAll("path.mpLink")
      .data(additionalLinks);

  mpLink.enter().insert("path", "g")
      .attr("class", "mpLink")
      .attr("x", nodeWidth / 2)
      .attr("y", nodeHeight / 2)
      .attr("d", function (d) {
          var o = { x: source.x0, y: source.y0 };
          return diagonal({ source: o, target: o });
      });

  mpLink.transition()
      .duration(duration)
      .attr("d", diagonal)
      .attr("stroke-width", function (d) {
          if (currentInfoboxNode == null) return;
          return (d.source == currentInfoboxNode
              || d.target == currentInfoboxNode) ? 2.7 : 2.0;
      })
      .style("stroke", function (d) {
          if (currentInfoboxNode == null) return;
          if (d.source == currentInfoboxNode) return "#f23d3d";
          if (d.target == currentInfoboxNode) return "#2185ff";
          return "#A9A9A9"
      });

  mpLink.exit().transition()
      .duration(duration)
      .attr("d", function (d) {
          let o = { x: source.x, y: source.y };
          return diagonal({ source: o, target: o });
      })
      .remove();

  // ======== transform ========
  nodes.forEach(function (d) {
      d.x0 = d.x;
      d.y0 = d.y;
  });*/
}