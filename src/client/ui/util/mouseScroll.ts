const dragThreshold = 20;

export function enableHorizontalDragScroll(element: HTMLElement)
{
    let mouseDown = false;
    let xStart = 0;
    let scrollLeft = 0;
    let dragging = false;

    const stopDragging = () => {
        if (dragging)
        {
            element.removeEventListener("click", preventClick);
            dragging = false;
        }
    };

    element.addEventListener("mousedown", (event: MouseEvent) => {
        mouseDown = true;
        xStart = event.pageX - element.offsetLeft;
        scrollLeft = element.scrollLeft;
        element.style.cursor = "grabbing";
        stopDragging();
    });

    element.addEventListener("mouseleave", () => {
        mouseDown = false;
        element.style.cursor = "grab";
    });

    element.addEventListener("mouseup", () => {
        mouseDown = false;
        element.style.cursor = "grab";
    });

    document.addEventListener("mousemove", (event: MouseEvent) => {
        if (!mouseDown)
            return;
        event.preventDefault();
        const x = event.pageX - element.offsetLeft;
        const xOffset = x - xStart;
        element.scrollLeft = scrollLeft - xOffset;

        const shouldBeDragging = (Math.abs(xOffset) > dragThreshold);
        if (!dragging && shouldBeDragging)
        {
            element.addEventListener("click", preventClick);
            dragging = true;
        }
    });
}

export function enableVerticalDragScroll(element: HTMLElement)
{
    let mouseDown = false;
    let yStart = 0;
    let scrollTop = 0;
    let dragging = false;

    const stopDragging = () => {
        if (dragging)
        {
            element.removeEventListener("click", preventClick);
            dragging = false;
        }
    };

    element.addEventListener("mousedown", (event: MouseEvent) => {
        mouseDown = true;
        yStart = event.pageY - element.offsetTop;
        scrollTop = element.scrollTop;
        element.style.cursor = "grabbing";
        stopDragging();
    });

    element.addEventListener("mouseleave", () => {
        mouseDown = false;
        element.style.cursor = "grab";
    });

    element.addEventListener("mouseup", () => {
        mouseDown = false;
        element.style.cursor = "grab";
    });

    document.addEventListener("mousemove", (event: MouseEvent) => {
        if (!mouseDown)
            return;
        event.preventDefault();
        const y = event.pageY - element.offsetTop;
        const yOffset = y - yStart;
        element.scrollTop = scrollTop - yOffset;

        const shouldBeDragging = (Math.abs(yOffset) > dragThreshold);
        if (!dragging && shouldBeDragging)
        {
            element.addEventListener("click", preventClick);
            dragging = true;
        }
    });
}

function preventClick(event: MouseEvent)
{
    event.preventDefault();
    event.stopImmediatePropagation();
}
