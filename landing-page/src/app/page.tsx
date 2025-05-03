import React from 'react';
import Image from 'next/image';

// Simple placeholder for potential icons
// const CheckIcon = () => (
//   <svg className="w-6 h-6 inline-block mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
//   </svg>
// );

export default function LandingPage() {
  return (
    <div className="bg-gray-50 text-gray-800">
      {/* Hero Section */}
      <section className="text-center pt-10 pb-20 px-4 bg-gradient-to-b from-white to-gray-100">
        {/* Banner Image */}
        <div className="relative w-full max-w-4xl mx-auto mb-10 h-50 md:h-50 lg:h-50">
          <Image
            src="/images/banner image.png"
            alt="Job Speak banner showing confident professionals"
            fill
            style={{ objectFit: 'cover' }}
            priority
            className="rounded-lg shadow-md"
          />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900">
          Ace Your Next Career Conversation
        </h1>
        <h2 className="text-xl md:text-2xl text-gray-700 mb-6 max-w-3xl mx-auto">
          Transform interview anxiety into job-winning confidence with AI-powered conversation coaching
        </h2>
        <p className="text-md md:text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Job Speak helps you master the conversations that matter most in your career journey. Record, review, and refine your professional conversations with personalized AI coaching that helps you showcase your best self.
        </p>
        <a
          href="#start" // Link to CTA section or signup page
          className="bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300"
        >
          Start Preparing Smarter
        </a>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
          Your Career Success Partner
        </h3>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h4 className="text-xl font-semibold mb-3">Practice That Feels Real</h4>
            <p className="text-gray-600">
              Upload your resume and job descriptions to generate tailored mock interview questions that prepare you for the real thing.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h4 className="text-xl font-semibold mb-3">Private Conversation Analysis</h4>
            <p className="text-gray-600">
              Record networking calls, mentorship discussions, and interview practice sessions. Review them on your terms to identify strengths and growth areas.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h4 className="text-xl font-semibold mb-3">AI-Powered Feedback</h4>
            <p className="text-gray-600">
              Receive instant, personalized coaching on your communication style, response quality, and areas for improvement without judgment.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h4 className="text-xl font-semibold mb-3">Progress Tracking</h4>
            <p className="text-gray-600">
              Watch your confidence grow as you practice more conversations and implement coaching suggestions.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 px-4 bg-gray-100">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
          What Our Users Are Saying
        </h3>
        <div className="max-w-4xl mx-auto space-y-8">
          <blockquote className="bg-white p-6 rounded-lg shadow-md text-gray-700 italic border-l-4 border-blue-900">
            <p>&quot;After using Job Speak for just two weeks, I walked into my dream job interview with a level of confidence I&apos;ve never felt before. The personalized feedback was like having a career coach in my pocket.&quot;</p>
            <footer className="mt-4 text-right font-semibold text-gray-600 not-italic">— Alexis T., Software Engineer</footer>
          </blockquote>
          <blockquote className="bg-white p-6 rounded-lg shadow-md text-gray-700 italic border-l-4 border-blue-900">
            <p>&quot;The mock interview questions were eerily similar to what I was actually asked! Job Speak helped me prepare answers that highlighted my strengths perfectly.&quot;</p>
            <footer className="mt-4 text-right font-semibold text-gray-600 not-italic">— Marcus K., Marketing Specialist</footer>
          </blockquote>
          <blockquote className="bg-white p-6 rounded-lg shadow-md text-gray-700 italic border-l-4 border-blue-900">
            <p>&quot;As someone with interview anxiety, being able to practice and get feedback in private was a game-changer. I got the job offer yesterday!&quot;</p>
            <footer className="mt-4 text-right font-semibold text-gray-600 not-italic">— Jamie L., Healthcare Administrator</footer>
          </blockquote>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4">
        <h3 className="text-3xl font-bold text-center mb-12 text-gray-900">
          How It Works
        </h3>
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="bg-blue-900 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-3">1</div>
            <h4 className="font-semibold mb-1">Upload Your Materials</h4>
            <p className="text-sm text-gray-600">Share your resume and target job descriptions</p>
          </div>
          <div>
            <div className="bg-blue-900 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-3">2</div>
            <h4 className="font-semibold mb-1">Practice Conversations</h4>
            <p className="text-sm text-gray-600">Record mock interviews or networking discussions</p>
          </div>
          <div>
            <div className="bg-blue-900 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-3">3</div>
            <h4 className="font-semibold mb-1">Receive Coaching</h4>
            <p className="text-sm text-gray-600">Get personalized feedback on your communication</p>
          </div>
          <div>
            <div className="bg-blue-900 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-3">4</div>
            <h4 className="font-semibold mb-1">Refine & Improve</h4>
            <p className="text-sm text-gray-600">Apply insights to build your confidence</p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="start" className="py-20 px-4 bg-blue-900 text-white text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Start Preparing Smarter
        </h2>
        <p className="text-lg md:text-xl text-blue-200 mb-8 max-w-2xl mx-auto">
          Your next career opportunity is waiting. Are you ready to speak with confidence?
        </p>
        <a
          href="https://app.jobspeak.us"
          className="bg-white hover:bg-gray-100 text-blue-900 font-bold py-3 px-8 rounded-lg text-lg transition duration-300 shadow-md"
        >
          Get Started Now
        </a>
        <p className="mt-6 text-sm text-blue-300">
          Free 7-day trial • No credit card required • Cancel anytime
        </p>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 text-center text-gray-500 text-sm bg-gray-100 border-t border-gray-200">
        © {new Date().getFullYear()} Job Speak. All rights reserved.
        {/* Add other footer links as needed */}
      </footer>
    </div>
  );
}
