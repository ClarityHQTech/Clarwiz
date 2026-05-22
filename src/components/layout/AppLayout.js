"use client"
import Footer from "./Footer"
import Header from "./Header"

const AppLayout = () => (WrappedComponent) => {

  const withLayout = (props) => {

    return(
    <div className='min-h-[100vh]'>
        <div className=''>
          <Header/>
        </div>

        <div className=''>
        <WrappedComponent {...props}/>
        </div>

        <div className=' w-full h-[4rem] '>
          <Footer/>
        </div>
    </div>
    )
  };

  return withLayout;
}

export default AppLayout