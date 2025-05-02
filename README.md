# Player project

Welcome to **Just Another Player**, which has been a fun and educational project designed to help me learn about video playback using **Media Source Extensions (MSE)** and **Adaptive Bitrate (ABR) algorithms**. This project is a hands-on way to learn about video streaming technologies, ABR strategies, and how to build a custom video player. It's very much still in progress, and I hope to continue to add and update different ABR algorithms.

---

## Table of Contents

-   About the Project
-   Features
-   Getting Started
    -   Prerequisites
    -   Installation
-   Usage
-   Folder Structure
-   ABR Algorithms
-   Learning Goals
-   Contributing
-   License

---

## About the Project

This project is a custom video player built with **TypeScript**, **React**, and **MSE (Media Source Extensions)**. It supports multiple ABR (Adaptive Bitrate) algorithms and allows you to experiment with video playback, quality switching, and buffering strategies.

The goal is to provide a platform for learning and experimenting with video streaming technologies while having fun building something cool.

---

## Features

-   **Custom Video Player**: Built from scratch using MSE for video playback.
-   **ABR Algorithms**: Includes both **Fixed ABR** and **Buffer-Based ABR** strategies. I am still working on these, and would also like to add a Throughput-based algorithm.
-   **Manual Quality Selection**: Switch between video qualities using a simple UI.
-   **HLS Playback**: Supports `.m3u8` playlists and `.ts` segments.
-   **Clean Architecture**: Modular design for easy experimentation and learning.

---

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

-   **Node.js** (v16 or higher)
-   **npm** or **yarn**
-   A modern browser that supports **Media Source Extensions (MSE)** (e.g., Chrome, Edge, or Firefox).

### Installation

1. Clone the repository

2. Install dependencies:

    ```
    npm install
    ```

3. Start the development server:

    ```
    npm start
    ```

4. Open your browser and navigate to:
    ```
    http://localhost:5173
    ```

---

## Usage

### Playing a Video

1. Place your `.m3u8` playlist and `.ts` segments in the hls folder, or add an m3u8 to the UI's input field.
2. Update the src prop in the `Player` component with the path to your `.m3u8` file:
    ```tsx
    <Player src="http://localhost:5173/hls/master.m3u8" abrManager="buffer" />
    ```
3. Use the **Quality Selector** to manually switch between video qualities or let the ABR algorithm handle it automatically.

---

## Folder Structure

```
just-another-player/
├── public/
│   ├── hls/                # HLS playlists and segments
│   └── ...
├── src/
│   ├── abr/                # ABR algorithms (Fixed and Buffer-Based)
│   ├── components/         # React components (Player, QualitySelector, etc.)
│   ├── playback-engine/    # MSEEngine and related logic
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions (e.g., playlist fetching)
│   └── ...
├── index.html              # Entry point for the app
├── package.json            # Project dependencies and scripts
└── README.md               # Project documentation
```

---

## ABR Algorithms

### Fixed ABR

-   Selects a fixed quality based on user input.
-   Useful for manual quality selection and testing.

### Buffer-Based ABR

-   Dynamically adjusts quality based on buffer length.
-   Switches to lower quality when the buffer is low and higher quality when the buffer is sufficient.

### Throughput-Based ABR (Coming Soon)

-   Dynamically adjusts quality based on measured network throughput.
-   Selects the highest quality that can be streamed without causing buffering.
-   Adapts quickly to changes in network conditions to ensure smooth playback.

---

## Learning Goals

This project was designed to help me learn about:

1. **Media Source Extensions (MSE)**:

    - How to use MSE to play `.ts` segments.
    - Managing `SourceBuffer` and `MediaSource` for seamless playback.

2. **Adaptive Bitrate (ABR) Algorithms**:

    - Implementing and experimenting with different ABR strategies.
    - Understanding how ABR impacts user experience and playback quality.

3. **Video Streaming Concepts**:

    - HLS (HTTP Live Streaming) and `.m3u8` playlists.
    - Buffering, seeking, and codec management.

4. **Frontend Development**:

    - Building a modular React application with TypeScript.
    - Creating reusable components like `Player` and `QualitySelector`.

5. **Building and Deploying from Scratch**:
    - Designing and implementing a video player from the ground up.
    - Setting up a development workflow, including build tools and scripts.
    - Learning how to deploy the application to a live environment for others to use and test.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---
