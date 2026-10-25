export async function fetchLocation() {
    // Return immediately if running in Playwright/Chromium testing
    if (navigator.webdriver) {
        return {
            country_name: "Lapland",
        };
    }

    const mockStateId = window.location.search.split("mockStateId=")[1];

    const isTestMode = localStorage.getItem("isTestMode");
    if (isTestMode || mockStateId) {
        return {
            country_name: "Lapland",
        };
    }
    // console.log("----- fetchLocation -----");
    // Check localStorage first
    const cachedLocation = localStorage.getItem("userLocation");
    if (cachedLocation) {
        try {
            const parsedData = JSON.parse(cachedLocation);

            return parsedData;
        } catch (error) {
            console.error("Error parsing cached location data", error);
            // If parsing fails, proceed to fetch
        }
    }

    // If not in cache or parsing failed, fetch from API
    try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();

        // Save to localStorage
        localStorage.setItem("userLocation", JSON.stringify(data));
        return data;
    } catch (error) {
        console.error("Error fetching location", error);
        return null;
    }
}
