import ACTIONS from './index'
import axios from 'axios'

export const dispatchLogin = () => {
    return{
        type: ACTIONS.LOGIN
    }
}

export const fetchUser = async (token) => {
    const res = await axios.get('/user/infor',{
        headers: {Authorization: token}
    })
    console.log(res.data.user.role)
    return res
}

export const dispatchGetUser = (res) => {
   return {
       type: ACTIONS.GET_USER,
       payload: {
           user: res.data.user,
           isAdmin: res.data.user.role === 1 ? true : false
       }
   }
}