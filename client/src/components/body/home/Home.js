import React from 'react'
import './home.css'

function Home() {
    return (
        <div className="home_page">
            <h2>Hello everyone! This site is about user authentication, 
                so there won't be any other pages here. </h2>

            <h3>e-commerce site codes</h3>
            <a href="https://github.com/kavindumadushanka972/BookShop--eCommerce" target="_blank" 
            rel="noopener noreferrer">My E-Commerce github repo</a>
                

            <h3>e-commerce site demo</h3>
            <a href="https://bookshop-mern.herokuapp.com/" target="_blank" 
            rel="noopener noreferrer">E-Commerce Demo</a>
        </div>
    )
}

export default Home