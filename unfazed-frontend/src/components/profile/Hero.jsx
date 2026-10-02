export default function Hero({ therapist }) {
  return (
    <section className="card" style={{ background: '#e8f0e9', padding: 'clamp(24px,5vw,60px)' }}>
      <p className="eyebrow">A SPACE TO BE YOURSELF</p>
      <h1>{therapist.name}</h1>
      <p>A thoughtful first step towards feeling more like you.</p>
      <div>
        {therapist.languages.map((language) => (
          <span className="tag" key={language}>
            {language}
          </span>
        ))}
      </div>
    </section>
  );
}
