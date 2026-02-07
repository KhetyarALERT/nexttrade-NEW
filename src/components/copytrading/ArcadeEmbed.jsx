import React from "react";

export default function ArcadeEmbed() {
  return (
    <div style={{ position: "relative", paddingBottom: "calc(48.17708333333333% + 41px)", height: 0, width: "100%" }}>
      <iframe
        src="https://demo.arcade.software/3bzhJYgsj3UDsnXH6Zld?embed&embed_mobile=inline&embed_desktop=inline&squared=true&show_copy_link=true"
        title="نسخ التداول الالي"
        frameBorder="0"
        loading="lazy"
        allowFullScreen
        allow="clipboard-write"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", colorScheme: "light" }}
      />
    </div>
  );
}