# 🏠 Weather to Stay or Not

Welcome! This is an evaluation project for Warden.

You are provided with a slice of the Warden backend codebase. At present, it contains only one API endpoint, `/get-properties`, which returns the first 20 properties and supports basic text search.

In the file `.env.example` you are given readonly credentials of a live hosted database. This db is already populated with properties data on which this API operates.

## Objectives

Your task is to build a single **search page in Next.js** that consumes this API to return accurate results and provides users with both search and filtering capabilities. **Specific Requirement is given below.**

The focus here is **functionality rather than design**. This means the main priority is on backend query optimization (efficiently handling multiple filters, scaling to larger datasets, and returning results quickly) and smooth frontend integration (accurate wiring between filters, search, and API responses). The UI itself can remain minimal: a simple search bar, intuitive filtering inputs, and property cards showing relevant information are more than enough.

## User Requirements

![It sure is a hot one today](https://arden-public.s3.ap-south-1.amazonaws.com/hotone.jpg)

Our Product team has identified that weather is a critical factor when people choose properties to stay at. In fact, some residents might even reject a job offer if the local weather doesn’t suit them. To address this, we need to enhance the property search experience by adding **live weather-based filters**.

The Marketing team is also planning to run a campaign that will bring a lot of traffic. So, along with Tech, all three teams meet to discuss what needs to be done.

After a 9 hour meeting, following filters and constraints were finalized.

| **Filter**             | **Input Type**          | **Allowed Range/Options**                                                                                                                                                                                                                     |
| ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Temperature Range (°C) | Numeric range (min/max) | -20°C to 50°C                                                                                                                                                                                                                                 |
| Humidity Range (%)     | Numeric range (min/max) | 0% to 100%                                                                                                                                                                                                                                    |
| Weather Condition      | Dropdown (grouped)      | - **Clear:** 0 (clear sky)<br>- **Cloudy:** 1–3 (partly cloudy to overcast)<br>- **Drizzle:** 51–57 (light to dense drizzle)<br>- **Rainy:** 61–67, 80–82 (rain showers, light to heavy)<br>- **Snow:** 71–77, 85–86 (snowfall, snow showers) |

> **Note:** The numbers listed under "Weather Condition" refer to weather codes as defined by [WMO](https://codes.wmo.int/common/weather-code) (World Meteorological Organization)

## Approach

1. Use [Open-Meteo](https://open-meteo.com/) to fetch **live weather data** by passing `latitude` and `longitude` from each property. No API key is required.

2. You only have **readonly access** to the provided database. If you wish to create migrations or modify the schema, please follow the [migration guide](docs/migrations.md).

## Installation

1. Clone this repository and move into the folder:
   ```bash
   git clone <repo-url>
   cd warden-test-one
   ```
2. Install Dependencies
   ```bash
   npm i
   npm run prisma:gen
   ```
3. Copy Environment File
   ```bash
   cp .env.example .env
   ```
4. Start the development server
   ```bash
   npm run dev
   ```
   open `http://localhost:5000` you should see "Warden Weather Test: OK"

## Technical Expectations

1. Use strict types as much as possible.

2. Keep the code modular, resource efficient and fast!

3. Keep a good commit history, with small meaningful commits

## Quality Expectations

Assume that you are already working here, and you are given full responsibilty ownership of this endpoint. Treat this codebase as production!

If you feel that you can enhance this project with any additional filters, better UI elements, or something different altogether! Feel free to run wild.

## Deliverables

1. A working app with the required changes as per the assignment.

2. README.md with setup/run instructions. Include .env.example and a seed step (if any) if you've changed db schema.

3. AI_USAGE.md that lists where you used AI/coding assistants, prompts you asked for substantive code, and how you verified/modified results. AI use is not discouraged, but we want to understand how you structure your prompts.

4. A 5-10 min video walkthrough via Loom showing the working feature and explaining your approach, a couple of decisions, and at least one scenario where you discovered some critical foresight and changed your approach.

## Submission

- You have **48 hours** from the time you receive the assignment email to complete and submit your solution.

- After making all required changes, **push your code to a public repository**.

- **Share the public repo link** and all deliverables by replying to the assignment email, and **CC hiring@wardenera.com**.

- Use the subject line: `Weather to Stay or Not | Warden Assignment by {your_name}`.

Good luck, have fun.
