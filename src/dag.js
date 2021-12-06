let scale;
let svgSelection;
let defs;
let nodes;
let width = 600, height = 400;

// Define the zoom function for the zoomable tree
var zoom = d3.zoom()
      .scaleExtent([1, 10])
      //.translateExtent([[0, 0], [width, height]])
      .on('zoom', function(event) {
        graph
            .attr('transform', event.transform);
});


(async () => {
    // fetch data and render
    const resp = await fetch(
      "data.json"
    );
    const data = await resp.json();
    const dag = d3.dagStratify()(data);
    let maxTextLength = 200;
    let nodeWidth = maxTextLength + 20;
    let nodeHeight = 100;
    const layout = d3
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
  
    // How to draw edges
    const line = d3
      .line()
      .curve(d3.curveCatmullRom)
      .x((d) => d.x + nodeWidth/2)
      .y((d) => d.y + nodeHeight/2);
  
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
          .attr("stop-color", colorMap.get(source.data.id));
        grad
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", colorMap.get(target.data.id));
        return `url(#${gradId})`;
      });
  
    // Select nodes
    nodes = graph
      .append("g")
      .selectAll("g")
      .data(dag.descendants())
      .enter()
      .append("g")
      .attr("transform", ({ x, y }) => `translate(${x}, ${y})`);
  
    // Plot nodes
    nodes
      .append("rect")
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("stroke-width", 1.5)
      .attr("fill", "#f4f4f9");
  
    // Add text to nodes
    nodes
      .append("text")
      .attr("y", nodeHeight / 2)
      .attr("x", 13)
      .attr("dy", ".35em")
      .text((d) => d.data.title)
      //.call(wrapNodeText, maxTextLength)
      //.style("fill-opacity", 1e-6)
      //.on("click", onTreeNodeClicked);
  })();
  

  